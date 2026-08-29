# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2025-01-08

### Added

- Customizable jail rules [99d762c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/99d762cde7d6df4446cd9cf2d7acafc15d44c9f2) (08-01-2025)
- Implement a firewall and fail2ban to combat brute force attacks [c582e13](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c582e138ff68714ac755af16d3cb1ec0299898d5) (07-01-2025)
- Implementation SPF [ac44ffc](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ac44ffca5447090813d8febc58df4cd82dda9ef2) (06-01-2025)
- Implementation successful opendkim with antivirus ok [2f4b03f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2f4b03fad2645714a5eb5e5aae06dc3ce42b6c17) (06-01-2025)
- Add util command ll [1538caa](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1538caa9232be93011f56be858a49a2091972d16) (06-01-2025)
- Add spf rules [558f70f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/558f70f0c5ade13810af001b57ac48cefc50b7ee) (06-01-2025)
- Add notification on spam rejection [47fb1a6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/47fb1a62bf896f8389fcc9eab5b5617eead071ec) (05-01-2025)
- Add clamav rules to rspamd [926b8ed](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/926b8ed3d46eb555219b01805d307e359ee3a13c) (05-01-2025)
- Persist clamav database [d9affeb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d9affeb5bb5a31fd5801d09b897a02cedc9c2c7d) (05-01-2025)
- Persist config data from rspamd [bf59115](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf59115b6ec9bd522d9d8c547d6bf81e390e2153) (02-01-2025)
- Add spam flag with redirect in spam folder [9de63b3](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9de63b3eea9fcde300af273d57167f184cd4ceb7) (02-01-2025)
- Persist redis data from rspamd [4666ab1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4666ab1bf40833990a75e91821f7471464a8366a) (01-01-2025)
- Implement rspamd web interface [00756d7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/00756d7ead92e3bdcdc8cefcffbffa3483fe9965) (01-01-2025)
- Add custom virtual hosts for apache 2 & change access port [a484268](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a484268b08c90643e14de249ece61e8d0ad8df48) (01-01-2025)
- Add rspamd with settings & implement Bayesian self-learning ham, spam in dovecot [ee7448a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ee7448a3c8423db11ac2abadcf1fb55ada758f2b) (01-01-2025)
- Add update auto certificate script [ff71f4e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ff71f4e3e4f326e0f6871a5fe1f5c8773959a897) (30-12-2024)
- Implements the ability to enable or disable antivirus [ac89d21](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ac89d21ed497c407feb9b4b435253c5d61780143) (28-12-2024)
- Add postfix volume [f765b63](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f765b63595903f854fdeadfe2fca3f50314f4236) (28-12-2024)
- Add task cron, refresh antivirus [bd63796](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bd637963d67e38a486b8273e12718ecfd7b65d68) (28-12-2024)
- Add sieve rules [23e97de](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/23e97de6bf23e53e27914602086449d1fd52c2a9) (27-12-2024)
- Add roundcube webmail with basic configuration [e199da6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e199da659c92c1e6fc4dbe6d06736aca89fcef0b) (27-12-2024)
- Adds functional container with postfix, dovecot, database and configuration [585880b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/585880ba1ed2104f73e2ba6d67251962830b6c24) (25-12-2024)
- Separate dockerfiles in dedicated folder && import repository in docker container [73a2a3f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/73a2a3f4016efd111037a0a54eb2392b4a800fda) (17-12-2024)
- Add environnement file at nest api [b71d069](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b71d069b931bea4ed719a61675fe2b5b67b3225e) (17-12-2024)

### Changed

- Check fail2ban implementation [8663cd2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8663cd28a7c6962e97e3c735917c200ef9f62527) (07-01-2025)
- Merge pull request #4 from padcmoi/feature/sign-with-opendkim [bd4da71](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bd4da71ea3ef9bfeb736d3975609504caeda4169) (07-01-2025)
- Fix attempt fix mysql error log [93d389f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/93d389fb481c4d8333318957a28719cd85e549fb) (07-01-2025)
- Merge branch 'main' into feature/sign-with-opendkim [430d5f9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/430d5f98b84faad829f7eff4b5d42617f8263be7) (06-01-2025)
- Merge branch 'main' into feature/sign-with-opendkim [589b712](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/589b7122df6615b0d8eeab027b65806fe1bf496f) (06-01-2025)
- Disable logs mysql server [f7767ab](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f7767ab4798ced9cf6d79d33c4b25083674a4394) (06-01-2025)
- Also provides a nice, ready-to-use public key file for sending to DNS [98e6de6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/98e6de661445ec8f7a500954ec00111037033766) (06-01-2025)
- Check opendkim [1b26895](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1b2689582573f8bad60ddb8e95a0345eb96a2894) (05-01-2025)
- Fix api details [11a7f92](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/11a7f9252091c6dfb74756433379bc0f10624688) (05-01-2025)
- Disable API instruction (no create) to reduce build time [d47ce15](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d47ce154c5e7cf3217e41441989084a35e45ee3f) (05-01-2025)
- Merge pull request #3 from padcmoi/feature/migrate-antivirus-filtering-from-amavis-to-rspam [fbd8206](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fbd8206af499c5f4816b0a7713909db1d5406474) (05-01-2025)
- Remove old amavis [2e12c88](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2e12c88c906e2e69e7d3e054be55449b678bf17a) (05-01-2025)
- Remove useless old mail daemon and add tool [b01b3ad](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b01b3ad875ba8de90b43ffc1904a536cbb1a5d08) (05-01-2025)
- Update spam module readme [793cfbe](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/793cfbebcb3254ce5869b1a88b6dc7ebf4c887a1) (03-01-2025)
- Update modules added, rspam, postscreen [89edc07](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/89edc0754517c034d4c9d10da741806a33961fd5) (03-01-2025)
- Merge pull request #1 from padcmoi/feat/spam-implementation [929b9e1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/929b9e134011c115be04eaceee3fa28c8335c2b7) (03-01-2025)
- Fix postscreen volume lost after diff merge [d8cd1e7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d8cd1e70a2a00aebce32bed4721f364ef42e9ead) (31-12-2024)
- Resolve conflict from main branch [2f76f66](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2f76f66bc4c283365b437d528295345e201c7a5d) (31-12-2024)
- Move volumes folder to the root project [7191071](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/71910719ef76e5940cf88b0cb4be3dfe946c79ee) (31-12-2024)
- Feat; implement postscreen [a782c46](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a782c462f26cc11b718a4a97331d786a17987f00) (31-12-2024)
- Merge branch 'main' into feat/spam-implementation [7ff6287](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7ff62878087c294a5911436c344954c4d09785e7) (30-12-2024)
- Merge branch 'main' into feat/spam-implementation [8719b39](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8719b39ca29c988d89fd2c8c8d8eebf3c6a71deb) (28-12-2024)
- Init rspam implement [3778de7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3778de77ceee5fe26ab27f3d08e56e7b0ae92b7b) (28-12-2024)
- Add license [1eebe61](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1eebe6176e444fb9474ea5310e67441ec7071681) (17-12-2024)
- Create README.md [2ba1668](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2ba1668e1ee96c5143ca4f069812ae376a3ae4d7) (17-12-2024)
- Initial commit [bf0942e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf0942e282278c9ed1805b8dbdd15aaf0edccd7b) (17-12-2024)

### Fixed

- Transfer fail2ban log to syslog, notify ban & unban [577f6c5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/577f6c51759d4201419a785d919da47f41572f60) (08-01-2025)
- Remove mysql log from syslog and move warn mysql log in dedicated file [5cbf86d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5cbf86dbac985349269344bab0b756dae9402088) (07-01-2025)
- Add roundcube table to mailuser mysql user [5f177f8](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5f177f8af10bce0f6d1d1163438b208ea3d77ceb) (06-01-2025)
- Syslog missing [e12ae24](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e12ae2481c2eb05bea1b856af5606e3782acb161) (03-01-2025)
- Chown errors with unknow vmail user and group [170bc1c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/170bc1c909eb2342b51b3b04d89f0f28b71421b0) (02-01-2025)
- Default sieve rules to new user [80ec596](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/80ec59611d2753d6af3dd600131bb789396a35b8) (02-01-2025)
- Enable upstream spam flag [8499858](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8499858f3c09163e9f3fb100ca2bc7d9108c391e) (01-01-2025)
- Add whistlist ip to postscreen [e6b0c9d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e6b0c9dd2d28d15381cb1e7f5a4fdb2f8d4806f4) (01-01-2025)
- Sql tables numeric values with bigint [be7ee6e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/be7ee6e0ce9cfa9583c74c821e1f1e28f99d14e8) (30-12-2024)
- Roundcube adress imap, smtp server [7c04c92](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7c04c92214151ed4542274b60c6294645026f112) (30-12-2024)
- Disable IPV6 & restrictions rules & spamd missing conf [8cc7bee](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8cc7bee5ad263b3419bca305260e32079a4a750b) (29-12-2024)
- Sieve error on recipient autoresponses [fde84e5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fde84e5a62830b51c3a07fb6c1741dfdc17bdb19) (27-12-2024)
- Hostname ambigous key by fqdn_domain [5f8e6e4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5f8e6e4d6cde11d4daac02c1da48e6d13b6590f6) (27-12-2024)
- Provide start ssl cert [94044bf](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/94044bf4c8febf54fd96a616a873349bb004d36b) (25-12-2024)

### Security

- Merge pull request #6 from padcmoi/feature/security-fail2ban-firewall [95fb1eb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/95fb1eb08c566d6cda35935ef86dd09832480d5e) (08-01-2025)
- Merge branch 'main' into feature/security-fail2ban-firewall [3159e57](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3159e5743ec55587645e5af9f0c8cff7ba906476) (07-01-2025)

[0.1.0]: https://github.com/padcmoi/simply-a-dockerized-mail-server/releases/tag/v0.1.0
