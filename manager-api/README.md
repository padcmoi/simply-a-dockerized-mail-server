# manager-api

NestJS 11 administration API for the mail server v2. Multi-tenant management of domains, users, aliases and quotas. Auth via JWT access + refresh tokens. Runs behind nginx on `127.0.0.1`, HTTP only.

## Stack

- NestJS 11 + TypeScript strict (no `any`, no explicit return types)
- TypeORM + mysql2 driver -> mutualised MariaDB shared with the mail server (`mailuser`)
- JWT access + refresh (passport-jwt)
- argon2id for webadmin password hashes (separate from Dovecot SHA512-CRYPT mailbox passwords)
- helmet + class-validator + throttler + swagger
- pnpm + multi-stage Dockerfile

## DB usage

- Connects to the existing `mailserver` database
- Reads/writes the 7 prod tables : `Accounts`, `VirtualDomains`, `VirtualUsers`, `VirtualAliases`, `VirtualQuotaDomains`, `VirtualQuotaUsers`, `SieveRejectSenders`
- Adds NEW additive tables for its own state (webadmin credentials, refresh tokens, audit log) - never touches the existing schema

## Local dev

```bash
cp .env.sample .env
# fill DB_PASSWORD + JWT_*_SECRET
pnpm install
pnpm run start:dev
```

## Roles (planned)

- **admin** : full access to all domains and accounts
- **owner** : manages one or more domains (their `VirtualDomains.owner_id`)
- **user** : manages only its own mailbox (password change, alias creation, sieve rules)
