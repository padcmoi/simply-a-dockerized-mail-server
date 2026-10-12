# Your own icon, logo and favicon

The manager ships with its own marks: a small icon at the top of the sidebar, a
logo on the sign-in page and a favicon in the browser tab. A company that runs
the server can show its own instead, by replacing three SVG files kept with the
data of the server. Nothing is rebuilt, nothing is restarted, and a server
nobody personalised behaves exactly as if the feature did not exist.

## The three files

| File                      | Replaces                     | Shown at          | Stands in for                                        |
| ------------------------- | ---------------------------- | ----------------- | ---------------------------------------------------- |
| `custom-mail-icon.svg`    | the mark of the sidebar      | 24 x 24 px        | `favicon.svg`                                        |
| `custom-mail-logo.svg`    | the logo of the sign-in page | 64 x 64 px        | `naskot-mail-logo.svg`                               |
| `custom-mail-favicon.svg` | the icon of the browser tab  | the browser's own | `favicon.ico`, `favicon.svg`, `apple-touch-icon.png` |

The files the manager ships with are in
[`manager-ui/app/assets/`](../../manager-ui/app/assets/).

## Where they live

At the root of the volumes folder, the one `VOLUMES_PATH` of `.env` points to,
next to `mail/` and `mysql/`. With the default `VOLUMES_PATH=./volumes` that is
`docker/services/volumes/` in the project, the path being read from the folder
of the service files.

They are kept there, and not in the project, for three reasons: the folder
holds everything that belongs to one server and to no other, git knows nothing
of it so an update never touches the files, and the daily backup copies the
whole folder, so the marks travel with the mailboxes and come back with a
restore ([operations/backup.md](../operations/backup.md)).

## What the manager does when it starts

Each time `manager-api` starts, it looks for the three names. One that is
missing gets a copy of the mark the manager ships with:

| Name that is missing      | Copy of                |
| ------------------------- | ---------------------- |
| `custom-mail-icon.svg`    | `favicon.svg`          |
| `custom-mail-logo.svg`    | `naskot-mail-logo.svg` |
| `custom-mail-favicon.svg` | `favicon.svg`          |

- **A file that is already there is never touched**, replaced or not. The copy
  is made only where the name is free.
- **The copy is created open to everyone** (mode `777`). The volumes folder
  belongs to root, and this is what lets whoever administers the server replace
  the content of the file without being root.
- **A copy nobody replaced changes nothing.** The manager compares each file
  with the one it ships with, byte for byte: identical, it is not a custom mark,
  and the manager keeps serving its own, with the favicon in its three formats.
  The copies are there to be replaced, not to be used.
- **A copy that cannot be made never stops the start.** The API logs a warning
  and goes on with the marks it ships with.

Nobody has to replace anything. The three files can stay as they were created
for the whole life of the server.

## The rules

- **A file counts when it is a plain file** (a link is refused), not empty, and
  512 KB at most. Anything else is as if the file were not there.
- **The icon and the logo go together.** Both have to be there, and as soon as
  one of the two is replaced the manager shows the two files. One brand in the
  sidebar and another on the sign-in page is never what anyone wants, so a pair
  that is not complete falls back to the two marks the manager ships with.
- **The favicon stands on its own.** Replaced, it is the icon of the browser
  tab, whatever the two others are. Left as a copy, or removed, the tab keeps
  the favicon the manager ships with.

## Replacing a mark

Write the new drawing over the file, from the root of the project:

```sh
cp my-logo.svg docker/services/volumes/custom-mail-logo.svg
```

`cp` replaces the content of the existing file, which its mode allows to
anyone. A tool that writes a new file and renames it over the old one needs to
create a file in the folder, and so needs root: `sudo cp` works in every case.

The new mark is on screen within a minute, with no restart and no rebuild.

## Going back to the mark the manager ships with

Either copy the shipped file back over the custom one:

```sh
cp manager-ui/app/assets/naskot-mail-logo.svg docker/services/volumes/custom-mail-logo.svg
```

or delete the custom file, which takes root since the folder belongs to root:

```sh
sudo rm docker/services/volumes/custom-mail-logo.svg
```

Deleted, the file is back as a copy at the next start of `manager-api`. Mind
the pair: deleting the icon or the logo alone brings both back to the marks the
manager ships with until that next start.

## How long before a change shows

Up to a minute, for one reason: the interface's own server asks the API what
the server carries when it renders a page, and holds the answer for 60 seconds.

The files themselves are served with a five-minute cache, which delays nothing:
the address the page uses carries a version computed from the size and the date
of the files, so a replaced file has a new address and the browser fetches it.

## Checking what the manager uses

Ask the API from the host:

```sh
docker exec mail-manager-api node -e 'fetch("http://127.0.0.1:3000/api/v1/branding").then(async (r) => console.log(r.status, await r.text()))'
```

| Answer                                           | Meaning                                                 |
| ------------------------------------------------ | ------------------------------------------------------- |
| `{"custom":false,"version":null,"favicon":null}` | nothing was replaced: the manager shows its own marks   |
| `"custom":true` with a `version`                 | the icon and the logo come from the two files           |
| `"favicon"` holding a version instead of `null`  | the icon of the browser tab comes from the favicon file |

What was copied at the last start is in the log of the API:

```sh
docker logs mail-manager-api 2>&1 | grep BrandingService
```

## What the SVG has to be

- **Square, or close to it.** The sidebar and the sign-in page both draw their
  mark in a square box, 24 px and 64 px wide. A wide logo is shrunk to fit and
  comes out small.
- **Readable on a light and on a dark background.** The manager has both
  themes, and the file is shown as it is: a drawing in white only disappears on
  the light theme.
- **Self-contained.** The file is shown as an image and served under a content
  security policy that runs nothing and loads nothing: no script, no font and
  no picture fetched from elsewhere.
- **A custom favicon is offered alone.** When the favicon file is replaced, the
  tab is given that SVG and nothing else, so that the mark of the manager never
  shows next to another brand. A browser that does not draw SVG favicons then
  shows none.

## What this does not change

- **The name of the manager**, in the sidebar, on the sign-in page and in the
  tab title, is `MANAGER_APP_NAME` in `.env`
  ([INSTALL.md](../../INSTALL.md)).
- **The colours** are the theme, set from the manager itself
  ([configuration.md](configuration.md)).

## Usual mistakes

| What was done                                        | What the manager does                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Only the logo was replaced                           | Shows the two files; the icon, still a copy, looks like the shipped one      |
| The icon was deleted and the logo replaced           | Keeps its own two marks until the next start of the API recreates the icon   |
| A link was put in place of a file                    | Ignores it                                                                   |
| A file is empty or over 512 KB                       | Ignores it; for the icon or the logo, the pair falls back to the two shipped |
| The files were put at the root of the project        | Ignores them: only the root of the volumes folder is read                    |
| A file was replaced and the page still shows the old | Nothing to do: wait a minute, then reload the page                           |

## How it works

### Mounts

Both are in [`docker/services/manager-api.yml`](../../docker/services/manager-api.yml)
and its `.dev.yml` twin.

| Host                    | In the container | Mode       | Used for                                                              |
| ----------------------- | ---------------- | ---------- | --------------------------------------------------------------------- |
| `${VOLUMES_PATH}`       | `/host/volumes`  | read-write | the three files; written only by the copy made at start               |
| the root of the project | `/host/project`  | read only  | the shipped marks, in `manager-ui/app/assets`, to copy and to compare |

The folder is mounted, not the files: each of the three may or may not be
there, which a mount of a file cannot express. The API opens these three names
in it and nothing else.

### API

[`BrandingService`](../../manager-api/src/core/branding/branding.service.ts)
holds all of it: `seed()`, called from `onModuleInit`, makes the copies;
`state()` and `open()` look the files up again on every call, which is why a
change needs no restart.

Both routes of
[`BrandingController`](../../manager-api/src/api/branding/branding.controller.ts)
are public, like the sign-in page that needs them. They expose three drawings
and nothing else.

| Route                        | Answer                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/branding`       | `200` with `custom`, `version` and `favicon`, as in the table above                                     |
| `GET /api/v1/branding/:kind` | `200` with the file for `icon`, `logo` or `favicon`; `404` for any other kind, or when it is not custom |

A file is answered as `image/svg+xml` with three headers:
`Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`,
so that a script written into the file runs nowhere, not even when the address
is opened on its own, `X-Content-Type-Options: nosniff` and
`Cache-Control: public, max-age=300`.

### Interface

- [`plugins/branding.ts`](../../manager-ui/app/plugins/branding.ts) asks
  `GET /branding` from the interface's own server while it renders, holds the
  answer for a minute, and puts it in the shared state `branding`. The right
  logo is therefore in the first HTML the browser receives, instead of
  swapping in after the page has loaded.
- [`useBranding`](../../manager-ui/app/composables/useBranding.ts) turns that
  state into three addresses: the icon and the logo, each either the file of
  the API with its version or the bundled default, and the favicon, the file of
  the API or nothing.
- They are used by [`login.vue`](../../manager-ui/app/pages/login.vue) for the
  logo, [`AppNavigation.vue`](../../manager-ui/app/components/layout/AppNavigation.vue)
  for the sidebar mark and [`app.vue`](../../manager-ui/app/app.vue) for the
  tab.

### Tests

| Test                                                                                   | Pins                                                                                                            |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`branding.service.spec.ts`](../../manager-api/test/branding/branding.service.spec.ts) | the copies made at start and their mode, the untouched copy, the pair, the favicon alone, what counts as a file |
| [`branding.e2e-spec.ts`](../../manager-api/test/branding/branding.e2e-spec.ts)         | both routes answer without a token, the headers, the refused kinds                                              |
| [`acl-cartography.spec.ts`](../../manager-api/test/security/acl-cartography.spec.ts)   | the two routes are in the list of the routes that are public on purpose                                         |
| [`useBranding.spec.ts`](../../manager-ui/test/core/useBranding.spec.ts)                | the addresses the interface uses in each case                                                                   |
| [`tests/01-infra.sh`](../../tests/01-infra.sh), `t_branding_files`                     | on a running stack: the three files are in place and the route answers                                          |
