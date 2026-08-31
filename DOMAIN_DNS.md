# DNS records per mail domain

Placeholders to substitute:

| Placeholder         | Meaning                                    | Example                          |
| ------------------- | ------------------------------------------ | -------------------------------- |
| `<DOMAIN>`          | the domain you host email for              | `example.com`                    |
| `<MAIL_HOSTNAME>`   | the FQDN of this mail server               | `mail.example.com`               |
| `<MAIL_PUBLIC_IP>`  | public IPv4 of this mail server            | `203.0.113.10`                   |
| `<DKIM_SELECTOR>`   | selector printed by opendkim-genkey         | `dkim_2026_06`                   |

## 1. MX

| Name        | Type | Value                | Priority |
| ----------- | ---- | -------------------- | -------- |
| `<DOMAIN>`  | MX   | `<MAIL_HOSTNAME>.`   | 10       |
| `<MAIL_HOSTNAME>` | A | `<MAIL_PUBLIC_IP>` | -        |

## 2. SPF

| Name        | Type | Value                                          |
| ----------- | ---- | ---------------------------------------------- |
| `<DOMAIN>`  | TXT  | `v=spf1 mx ip4:<MAIL_PUBLIC_IP> -all`          |

## 3. DKIM

After `opendkim-genkey`, copy the printed `<DKIM_SELECTOR>.txt` content.

| Name                                       | Type | Value (from `.txt`)              |
| ------------------------------------------ | ---- | -------------------------------- |
| `<DKIM_SELECTOR>._domainkey.<DOMAIN>`      | TXT  | `v=DKIM1; k=rsa; p=...`          |

## 4. DMARC

| Name                       | Type | Value                                                            |
| -------------------------- | ---- | ---------------------------------------------------------------- |
| `_dmarc.<DOMAIN>`          | TXT  | `v=DMARC1; p=quarantine; rua=mailto:dmarc@<DOMAIN>; adkim=s; aspf=s` |

## 5. PTR

The PTR of `<MAIL_PUBLIC_IP>` must resolve to `<MAIL_HOSTNAME>`. Configure at
your hosting provider (NOT in your zone file).

## Verification

```bash
dig MX <DOMAIN> +short
dig A  <MAIL_HOSTNAME> +short
dig TXT <DOMAIN> +short
dig TXT <DKIM_SELECTOR>._domainkey.<DOMAIN> +short
dig TXT _dmarc.<DOMAIN> +short
dig -x <MAIL_PUBLIC_IP> +short
```

Then send to https://www.mail-tester.com (target 10/10).
