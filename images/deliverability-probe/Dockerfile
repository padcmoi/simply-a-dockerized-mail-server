FROM python:3.12-alpine

# dnspython for the lookups a diagnostic needs and the standard library does not
# offer (TXT, MX, TLSA, an rcode, a chosen nameserver), cryptography to load a
# DKIM public key and read its real modulus rather than trust a declared length.
RUN pip install --no-cache-dir dnspython==2.7.0 cryptography==44.0.0

# Unbuffered, so `docker logs` shows a run as it happens rather than at the end.
ENV PYTHONUNBUFFERED=1

WORKDIR /probe
COPY . /probe

# No EXPOSE and no published port: this container runs on the host's network
# stack, so that its packets reach postfix with the machine's public address
# instead of a docker one postfix has been told to trust. It binds the docker
# bridge gateway, which the manager reaches and the internet does not.

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- "http://${PROBE_BIND:-172.200.0.1}:${PROBE_PORT:-8080}/health" || exit 1

CMD ["python3", "/probe/probe.py"]
