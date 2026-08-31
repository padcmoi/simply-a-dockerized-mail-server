"""What every check reads, looked up once and shared.

The probe answers a whole report in one call, and most checks need the same
handful of facts: the MX, the address behind it, the reverse name, an SMTP
session. Looking those up per check would mean thirty DNS round trips for six
answers, so they are resolved on first use and kept for the run.
"""

import socket
import ssl
import re

import dns.resolver
import dns.reversename

TIMEOUT = 6
SMTP_TIMEOUT = 8

# A reply is finished when its last line has a space after the code rather than
# a dash. Postfix opens with a deliberate `220-Please wait ...` teaser, so
# stopping at the first line would take the trap for the banner.
FINAL = re.compile(rb"^\d{3} [^\n]*\r?\n", re.MULTILINE)

_MISSING = object()


class Session:
    """One SMTP conversation, read once and reused by every server check."""

    def __init__(self, ip):
        self.reachable = False
        self.banner = ""
        self.helo = ""
        self.capabilities = []
        self.starttls = False
        self.error = None
        self.certificate = None
        if ip:
            self._speak(ip)

    def _speak(self, ip):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(SMTP_TIMEOUT)
        try:
            sock.connect((ip, 25))
            self.reachable = True
            greeting = read_reply(sock)
            self.banner = last_line(greeting)[4:].strip()

            sock.sendall(b"EHLO deliverability-probe.example.com\r\n")
            ehlo = read_reply(sock)
            lines = [l for l in ehlo.replace("\r", "").split("\n") if l[:3].isdigit()]
            if lines:
                self.helo = lines[0][4:].strip().split(" ")[0]
            self.capabilities = [l[4:].strip() for l in lines[1:]]
            self.starttls = any(c.upper().startswith("STARTTLS") for c in self.capabilities)

            if self.starttls:
                self.certificate = self._negotiate(sock, ip)
            sock.sendall(b"QUIT\r\n")
        except Exception as e:  # noqa: BLE001 - any failure means "unreachable"
            self.error = f"{type(e).__name__}: {e}"
        finally:
            close(sock)

    def _negotiate(self, sock, ip):
        """The certificate as a sending server negotiates it, on port 25 itself."""
        sock.sendall(b"STARTTLS\r\n")
        if not read_reply(sock).lstrip().startswith("220"):
            return {"error": "STARTTLS refused"}
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            with ctx.wrap_socket(sock, server_hostname=ip) as tls:
                return {"cert": tls.getpeercert(), "der": tls.getpeercert(True), "version": tls.version()}
        except Exception as e:  # noqa: BLE001
            return {"error": f"{type(e).__name__}: {e}"}


class Context:
    def __init__(self, domain, selector=""):
        self.domain = domain.strip().lower().rstrip(".")
        self.selector = selector.strip()
        self._cache = {}

    # ------------------------------------------------------------------ dns
    def _memo(self, key, produce):
        value = self._cache.get(key, _MISSING)
        if value is _MISSING:
            value = produce()
            self._cache[key] = value
        return value

    def _resolver(self):
        return self._memo("resolver", self._build_resolver)

    @staticmethod
    def _build_resolver():
        r = dns.resolver.Resolver()
        r.lifetime = TIMEOUT
        r.timeout = TIMEOUT
        return r

    def query(self, name, kind, resolver=None):
        """A lookup that answers None rather than raising: an absent record is
        an answer, and the check above decides what it means."""
        try:
            return (resolver or self._resolver()).resolve(name, kind)
        except Exception:  # noqa: BLE001 - NXDOMAIN, timeout, refusal alike
            return None

    def txt(self, name, resolver=None):
        answer = self.query(name, "TXT", resolver)
        if answer is None:
            return None
        # A record over 255 bytes arrives split at the protocol level; joining
        # the chunks back is what makes a 2048 bit DKIM key readable.
        return ["".join(part.decode() for part in row.strings) for row in answer]

    def a(self, name, resolver=None):
        answer = self.query(name, "A", resolver)
        return [row.address for row in answer] if answer is not None else None

    def aaaa(self, name):
        answer = self.query(name, "AAAA")
        return [row.address for row in answer] if answer is not None else None

    def cname(self, name):
        answer = self.query(name, "CNAME")
        return [str(row.target).rstrip(".") for row in answer] if answer is not None else None

    def ptr(self, ip):
        try:
            answer = self._resolver().resolve(dns.reversename.from_address(ip), "PTR")
            return [str(row.target).rstrip(".") for row in answer]
        except Exception:  # noqa: BLE001
            return None

    def rcode(self, name, resolver=None):
        """NOERROR on a name holding no record of its own is what says
        "something exists below this node", the only honest way to ask whether a
        domain has ANY dkim selector without guessing selector names."""
        try:
            (resolver or self._resolver()).resolve(name, "TXT")
            return "exists"
        except dns.resolver.NoAnswer:
            return "exists"
        except dns.resolver.NXDOMAIN:
            return "empty"
        except Exception:  # noqa: BLE001
            return "unknown"

    def authoritative(self):
        """The zone's own nameservers, so a node's rcode is asked where it is
        authoritative instead of through a cache that may hold a stale NXDOMAIN."""
        return self._memo("authoritative", self._find_authoritative)

    def _find_authoritative(self):
        labels = self.domain.split(".")
        for i in range(len(labels) - 1):
            zone = ".".join(labels[i:])
            answer = self.query(zone, "NS")
            if answer is None:
                continue
            addresses = []
            for row in answer:
                found = self.a(str(row.target).rstrip("."))
                addresses.extend(found or [])
            if addresses:
                r = self._build_resolver()
                r.nameservers = addresses[:3]
                return r
        return None

    # -------------------------------------------------------------- the mail
    def mx(self):
        return self._memo("mx", lambda: self.query(self.domain, "MX"))

    def mx_host(self):
        def best():
            answer = self.mx()
            if not answer:
                return None
            row = sorted(answer, key=lambda m: m.preference)[0]
            return str(row.exchange).rstrip(".")

        return self._memo("mx_host", best)

    def mail_ip(self):
        def first():
            host = self.mx_host()
            found = self.a(host) if host else None
            return found[0] if found else None

        return self._memo("mail_ip", first)

    def ptr_name(self):
        def read():
            ip = self.mail_ip()
            names = self.ptr(ip) if ip else None
            return names[0] if names else None

        return self._memo("ptr_name", read)

    def session(self):
        return self._memo("session", lambda: Session(self.mail_ip()))

    def spf(self):
        def read():
            records = self.txt(self.domain) or []
            return [r for r in records if r.lower().startswith("v=spf1")]

        return self._memo("spf", read)

    def dmarc(self):
        def read():
            records = self.txt(f"_dmarc.{self.domain}") or []
            return [r for r in records if r.lower().startswith("v=dmarc1")]

        return self._memo("dmarc", read)


# --------------------------------------------------------------------- socket
def read_reply(sock):
    buffer = b""
    while True:
        chunk = sock.recv(4096)
        if not chunk:
            break
        buffer += chunk
        tail = buffer.rstrip().rsplit(b"\n", 1)[-1]
        if FINAL.match(tail + b"\r\n"):
            break
    return buffer.decode("utf-8", "replace")


def last_line(reply):
    lines = [line for line in reply.replace("\r", "").split("\n") if line.strip()]
    return lines[-1] if lines else ""


def close(sock):
    try:
        sock.close()
    except OSError:
        pass
