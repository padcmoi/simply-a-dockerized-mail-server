# Contributing

Simply Mail Server is an open project. Its goal is a complete mail platform,
mail server and manager together, that anyone can install on their own server
and keep up to date. Whether you fix a bug, add a feature, translate the
interface, improve the documentation or write a test, you are welcome.

## Why changes come here

A server receives its updates with `./update.sh`, which pulls this repository.
A server whose code was changed by hand falls off that path
([README.md](README.md#updating)). So a change that is useful to your server is
best proposed here: once merged, every server gets it, yours included, and it
keeps working through the updates that follow.

## Before you start

- **A bug**: open an issue with what you did, what you expected, what happened,
  and the logs of the containers involved. Remove any address, domain or
  secret of your own server first.
- **A large change or a new feature**: open an issue to discuss it before
  writing the code, so that the work fits the project and is not done twice.
- **A small fix**, a typo or a missing test: open a pull request directly.

## Branches

| Branch          | Holds                                                        |
| --------------- | ------------------------------------------------------------ |
| `develop`       | the work in progress; every pull request targets this branch |
| `release/X.Y.Z` | the release candidates of a version, tagged `vX.Y.Z-rc.N`    |
| `master`        | the final releases                                           |

## Setting up

1. Fork the repository and clone your fork.
2. Run `pnpm install` at the root: it installs the git hooks described below.
3. For a running stack, follow [INSTALL.md](INSTALL.md); `./service.sh up:dev`
   starts the development stack of `docker-compose.dev.yml`.

The documentation of every part of the project starts at
[docs/README.md](docs/README.md).

## Conventions

- **Commit messages** are written in English as `type(scope): description`,
  where `type` is one of `feat`, `fix`, `chore`, `refactor`, `docs`, `style`,
  `test` or `perf`, and the description says what changes for whoever uses the
  server.
- **Every commit adds one line to [CHANGELOG.md](CHANGELOG.md)**, under
  `## [Unreleased]`: in `### Added` for a `feat`, `### Fixed` for a `fix`, and
  `### Changed` for the others. The line is the commit subject followed by the
  date, as in `- fix(postfix): ... (17-10-2026)`.
- **The project stays generic.** No address, domain, secret or data of a real
  server goes into a commit. What belongs to one install goes in `.env` or in
  the volumes folder.
- **Code, comments and documentation are in English.** The interface is
  translated in `manager-ui/i18n/locales/`: a new text goes in every language
  there.
- **Every route of manager-api is tested** for its authentication and its
  permissions, and appears in the ACL cartography snapshot of
  `manager-api/test/security/`.

## Git hooks

| Hook       | Runs                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------- |
| pre-commit | `./prettier.sh` on the code and the markdown, then refuses a commit without a valid changelog line |
| pre-push   | `./test-node.sh` when the push changes `manager-api/` or `manager-ui/`                             |

## Tests

| Command                 | Checks                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `./test-node.sh`        | typecheck, lint and tests of manager-api, with its coverage thresholds, and of manager-ui                                                  |
| `./test-mailservers.sh` | the mail stack end to end, which it starts itself: authentication, delivery, sieve, blocklists, antivirus, Postfix limits, webmail, backup |

GitHub runs both, in seven jobs, on every push and every pull request. A pull
request is merged only when all of them are green. Its description says what it
changes, why, and how it was tested.

## License

By contributing, you agree that your contribution is published under the
[MIT license](LICENSE.md) of the project.
