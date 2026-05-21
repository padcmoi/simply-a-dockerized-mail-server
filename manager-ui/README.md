# manager-ui

Nuxt 3 SPA fronting `manager-api`. Runs behind nginx on `127.0.0.1`, HTTP only.

Login flow :

- **Local** : email + password against `POST /api/v1/auth/login`. The first account (root) is bootstrapped by `install.sh` on the host into `webadmin_accounts`.
- **Auth0 SSO** : redirects to the Auth0 tenant, comes back with an RS256 access token. Fill `NUXT_PUBLIC_AUTH0_*` env to enable.

## Pages

- `/login` - local email/password + Auth0 button
- `/` - dashboard + manager-api health
- `/domains` - list / create / DNS records
- `/users` - mailboxes
- `/aliases` - aliases

## Dev

```bash
cp .env.sample .env
pnpm install
pnpm run dev
```

## Stack

Nuxt 3 (SPA, ssr=false) + Tailwind CSS + `@pinia/nuxt` + `@vueuse/nuxt` + `@auth0/auth0-vue`.
