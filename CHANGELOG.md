# Changelog

## [1.1.2] - 2025-01-31
### Added
- Adds the first changelog
- Antivirus scanning can be done with a remote server, this choice is made in the environment file, 0=disabled, 1=enabled locally, 2=enabled on remote server

### Changed
- Reduces the risk of server crashes due to the antivirus consuming too many resources on a server with low memory capacity. This could cause a crash due to kswap. Now, antivirus scanning can be offloaded to a remote server.

### Fixed
- Antivirus crash and host machine crash (kswapd)

### Refactor
- N/A
