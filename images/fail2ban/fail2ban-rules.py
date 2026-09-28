#!/usr/bin/env python3
import ast
import json
import os
import subprocess
import sys

from fail2ban.server.mytime import MyTime

TARGET = "/var/lib/fail2ban/rules.json"
KEYS = ("maxretry", "findtime", "bantime")


def main():
    dump = subprocess.run(["fail2ban-client", "-d"], capture_output=True, text=True, timeout=60)
    if dump.returncode != 0:
        print(f"fail2ban-rules: fail2ban-client -d failed: {dump.stderr.strip()}", file=sys.stderr)
        return 1

    rules = {}
    for line in dump.stdout.splitlines():
        try:
            command = ast.literal_eval(line.strip())
        except (ValueError, SyntaxError):
            continue
        if not isinstance(command, list) or len(command) != 4 or command[0] != "set" or command[2] not in KEYS:
            continue
        _, jail, key, value = command
        seconds = int(value) if key == "maxretry" else int(MyTime.str2seconds(str(value)))
        rules.setdefault(jail, {})[key] = seconds

    rules = {jail: values for jail, values in rules.items() if all(key in values for key in KEYS)}
    temporary = f"{TARGET}.tmp"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(rules, handle, sort_keys=True)
    os.chmod(temporary, 0o644)
    os.replace(temporary, TARGET)
    print(f"fail2ban-rules: wrote the rules of {len(rules)} jails to {TARGET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
