# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.7] - 2025-09-24

### Changed

- Merge branch 'hotfix/1.1.7' [45e0400](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/45e04001c90abdf0a4db3ab4903471cf48c5d90c) (24-09-2025)
- Hotfix v1.1.7 [0b8b2f6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0b8b2f6f5578763043386aa7d38c8fc106047326) (24-09-2025)

## [1.1.5] - 2025-02-07

### Changed

- Merge branch 'hotfix/v1.1.5' [d2f1217](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d2f1217876453959c794ef6ee5135791d567be0f) (07-02-2025)

### Fixed

- Records SASL Login failed from postfix only if it has a domain _(fail2ban)_ [990fb28](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/990fb2823d6249795f2a5d6bf5aafdfc6bf5f154) (07-02-2025)

## [1.1.4] - 2025-02-07

### Changed

- Merge branch 'hotfix/v1.1.4' [ea4077c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ea4077c452e58db92ce71743eedf2e6da6e92486) (07-02-2025)

### Fixed

- Supports 3 auth worker messages [2ba848f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2ba848fb6f150382cb6d1fa73f005f155b67198a) (07-02-2025)
- Increase test time for postfix rules _(fail2ban)_ [2d9f116](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2d9f116b54f3ef316d8a5c0760643dd171a115b8) (07-02-2025)
- Excessive auth failed on legitimate connections [5d6e5bb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5d6e5bbb75c44ab93efff309a084d2f2bcf7346e) (07-02-2025)

## [1.1.3] - 2025-02-06

### Changed

- Merge branch 'hotfix/v1.1.3' [1c9b1dd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1c9b1dd681931ac03b0ed52bac0d723ee57a0710) (06-02-2025)

### Fixed

- Allow no tls connections [9f02f4c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9f02f4cf43c40e78abafbb15f33a385925f3e632) (06-02-2025)

## [1.1.2] - 2025-01-31

### Changed

- Merge branch 'bugfix/v1.1.2' into develop [1b26447](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1b26447dcbe3754335dd290a0a903f89b597e389) (31-01-2025)
- Logs are now in true realtime in menu script [9f6e17f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9f6e17fb7fdd80251f801eb1411d45ad1e4afa0f) (31-01-2025)
- Add a category refactor to changelog [9456de2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9456de2da5d83a53e637204bf3526471b5954826) (31-01-2025)
- Merge tag 'v1.1.1' into develop [bf46bbd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf46bbdcda4c8158089444ec133e81e49d4060f0) (27-01-2025)

### Fixed

- Reduces the risk of server crashes due to the antivirus consuming too many resources on a server with too low a memory capacity [eabb9ab](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/eabb9abb8a71815206978b790352c8d11b96e7b3) (31-01-2025)
- Removes the ban from log legitime on postfix _(fail2ban)_ [e802513](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e80251376a886269ae12cc94e51c51c4448ca10c) (27-01-2025)

## [1.1.1] - 2025-01-27

### Changed

- Merge branch 'hotfix/v1.1.1' [5dccb20](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5dccb20bb628ea2103a8d1ae2403085c5a9aca68) (27-01-2025)
- Adds a menu for complete management, installation and configuration of the docker mail server with ease and simplicity [03d5279](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/03d52792b0663cf28ad1dd9783ac2dd156b20b96) (26-01-2025)

### Fixed

- Prevents bots from polluting logs with failed connection attempts _(fail2ban)_ [b0afffa](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b0afffab924942db19db9f6be1c28d7d5f77f615) (27-01-2025)
- Provides the possibility of rejection or acceptation of dmarc evaluation failures, by default to false (before set to true) _(opendmarc)_ [3502328](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/350232881a67950b83a875ed9afd33a9fa11d67b) (27-01-2025)
- Adds recursive to copy fail2ban conf folder [722015a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/722015a633969c7511c68dd183b946e5b54378ba) (27-01-2025)
- Add custom postfix fail2ban filter [f452c19](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f452c19e98ab32a0c0bcff1291ff715bbac0954a) (27-01-2025)
- Disable rspamd/greylist causing milter-reject 4.7.1 Try again later on some mails [8ba3637](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8ba363704571cde526f26330e1fc6dd7df411419) (27-01-2025)

## [1.1.0] - 2025-01-26

### Added

- Adds MultipleSignatures and MustBeSigned configuration to the menu _(menu/opendkim)_ [37b9a14](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/37b9a14fd967b733e779c844c5195bd3189eb5b9) (26-01-2025)
- Menu implementation for local server installation, configuration and management [71c0c12](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/71c0c123aeada32099c74731e521f4da354e3484) (26-01-2025)
- Adds menu for configuration, management and installation [fe3e030](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fe3e030ee2b2434362cc117dc90c394b373ed1dd) (26-01-2025)
- Adds menu for configuration, management and installation [8ab4504](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8ab450467b4c4482c0009db3aa2e7d9af0b1d9df) (26-01-2025)

### Changed

- Adds a menu for complete management, installation and configuration of the docker mail server with ease and simplicity [ed56269](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ed56269618d06e4fc6fa6c75160389d5f31ebbdf) (26-01-2025)
- Merge branch 'feature/server-management-menu' of https://github.com/padcmoi/simply-a-dockerized-mail-server into feature/server-management-menu [d4a3aa1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d4a3aa19aa7366e92fafbbc8467924bb10a04487) (26-01-2025)

### Fixed

- If an incoming mail has been sent by a misconfigured mail server that doesn't sign with dkim, the default server policy is to refuse, this commit allows you to set the choice to the administrator with a default value of no _(opendkim)_ [d9c863e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d9c863eba716f36abbf448d0301468048e0a024d) (26-01-2025)

## [1.0.1] - 2025-01-26

### Fixed

- If an incoming mail has been sent by a misconfigured mail server that doesn't sign with dkim, the default server policy is to refuse, this commit allows you to set the choice to the administrator with a default value of no _(opendkim)_ [7c202bb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7c202bbc7fa18a3ff222c35ca4da9f63bbd31969) (26-01-2025)
- If an incoming mail has been sent by a misconfigured mail server that doesn't sign with dkim, the default server policy is to refuse, this commit allows you to set the choice to the administrator with a default value of no _(opendkim)_ [c69a083](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c69a083a9aa775a604367a9e6171e1b02947cb59) (26-01-2025)

## [1.0.0] - 2025-01-26

### Added

- Postfix log file in dedicated file or syslog [b09e21e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b09e21edeebfcea30d740aa1951e2ef08e3db439) (18-01-2025)
- Customize the path where volumes will be stored [6e4acea](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6e4acea0df656f1c10056bb62d0b88ec4ea52827) (17-01-2025)
- Adds the ability to enable e-mailing of dmarc reports [b449f7d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b449f7dfc5ab652e695cffb0319f14a7705f6db2) (16-01-2025)
- Add network utility [c73a0ed](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c73a0edaf0b2109b0c59b705bcaa5bece47540b1) (13-01-2025)
- Implementation complete of opendmarc, default setup, cron added [67bc614](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/67bc6142c23fc9551770a8d8b0a30eaf9e2888ba) (13-01-2025)
- Add utility reusable [8c4e86c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8c4e86c536fb8690414ccf0cd516cc280e1f4937) (13-01-2025)
- Add dmarc report for opendmarc, add a new volume [d61e5f9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d61e5f998fdb848f80623639b6ad220a76deece0) (13-01-2025)
- Add opendmarc with configuration [24dfd76](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/24dfd76568811756db83bd1575670e63c1787705) (13-01-2025)
- Add dmarc configuration with rspamd, disable dkim in rspamd [f3201bd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f3201bde61af2456137883d14bd5795bdc71481e) (12-01-2025)
- Copies volumes during docker build and renames them in a temporary folder, then reinjects them when the container is launched [2077d7a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2077d7a2f4231208e2aa31c6863809a4496c14ed) (09-01-2025)

### Changed

- Add firewall rules with ufw and add a basic config [d7d9fc5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d7d9fc59bf41498c20b52679f2dc37b068decb9a) (17-01-2025)
- Cleans up architecture for easier upgrades [8e2a6f9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8e2a6f92f079b9f1931a739b1db3ee1a7f5eb3ce) (17-01-2025)
- Moves docker folder to root folder [c04d1bd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c04d1bdefe2e8b8e32014ce73ecb058b91c8e961) (17-01-2025)
- Remove stdout 1 to avoid polluting with target mails root@domainFQDN [efef5e2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/efef5e200ae40d59ce7b5fffce9842ee104e49bf) (17-01-2025)
- Change ambiguous system password [4e09e82](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4e09e82b8c729e0243ad3edf7e29c5e9d4197578) (16-01-2025)
- Update title [6e736c7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6e736c7b73a22226f1c23bc985b43da425a3ad60) (16-01-2025)
- Missing reports at 0h [0a47651](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0a47651c02b890972ef617e31ddbdd4378c4d26f) (16-01-2025)
- Update datetime file, file constantly modified [1e6fc2a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1e6fc2ad1d76ddd557c739e150ae0ffe1d3f2472) (16-01-2025)
- Merge pull request #13 from padcmoi/debian11-bullseye [cc6a79d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/cc6a79d6a0e7fae2141a1b56658644ce3576236a) (15-01-2025)
- Merge pull request #12 from padcmoi/bugfix/mail-server [442127b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/442127b0ad6ed529baca5b616088e4bb5c3575ce) (15-01-2025)
- Enable SSL mode for phpmyadmin [205e966](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/205e9669643cab60b9e23a1dbf8727589bca2c04) (15-01-2025)
- Fix sql search sql to conf [bbbaac1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bbbaac122d146ddde39329361e6b0b52a13feaa2) (15-01-2025)
- Install roundcube in the image build, to solve the problem of creating databases from APT, add a SQL dump file [3aec3a9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3aec3a905ee5fe1fd7dc1a7a62b78b7770f2b485) (15-01-2025)
- Dmarc report script didn't work (overwrite) [911b443](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/911b44331a7b6e185de101f7f2799cae9e3b2b17) (15-01-2025)
- Dmarc report script didn't work [a8cb981](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a8cb9810f0e4c5a614b5436c1dcae8095e0d246b) (15-01-2025)
- Remove useless mysql command [1c54fd8](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1c54fd83dd3d2f71731e50396c2a87f48ff0b23e) (15-01-2025)
- Rfc complete ll command [863e01a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/863e01aa991ae72068c767e7ce0b42b93ec2866f) (15-01-2025)
- Install opendmarc in the image build, to solve the problem of creating databases from APT, add a SQL dump file [138a4be](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/138a4be4481ef69aad28dafdab2ae1843fb62d2b) (15-01-2025)
- Check_policy_service doesn't seem to accept multiple servers, already used by policy-spf [1284dce](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1284dce268bc35f4370ab3dc31b745102920c368) (14-01-2025)
- Move sample config in parent folder [fb2c50b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fb2c50b80089dc2b92b73ccf7724630c1c6a2f81) (14-01-2025)
- Improves the visual appearance of started services [8a73452](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8a734522cb0b970e67bb24c3c93a4b0ede5cc187) (14-01-2025)
- Improve network command [d60ce7c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d60ce7c76bb47dcbc988f5dc659eee5ec0a40936) (13-01-2025)
- Remove duplicate roundcube configuration in apache.conf, this configuration file becomes a site available to activate [8df7841](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8df78416c321740b3459de1415c941f7548b520a) (13-01-2025)
- Fix, show state services [4277241](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4277241f7564e84812b7fcb9c92cf99e19207f0b) (13-01-2025)
- Move services in each setup script, add default configuration to have functional services [6ca228d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6ca228d6b07adaf8d07d00892338712086436d44) (13-01-2025)
- Adds run after container in the docker setup sequence [162dd08](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/162dd0870e662786f288057a889bf1b60a3dcfe3) (13-01-2025)
- Merge pull request #5 from padcmoi/feature/e-mail-transfer-policy-dmarc [ed85dd7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ed85dd7515c2e743b582be6fc9e9cef82677d59d) (13-01-2025)
- Connections to postfix milter [d24b0cb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d24b0cbe8dc33a74b464c137a6474797bfbd7973) (13-01-2025)
- Remove duplicate element [def5cdd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/def5cdd34643dd8046af787079ef831b0a68af27) (12-01-2025)
- Merge branch 'trunk' into feature/e-mail-transfer-policy-dmarc [d8015aa](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d8015aa4f15b3608b5bfa6f10c1abd1e3b034314) (11-01-2025)
- Remove the clear command, for better observation [de940a4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/de940a4d94583b0479ecfada2052489b502ace41) (11-01-2025)
- Dovecot permissions issues on etc folder [01c22e0](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/01c22e02c135ede81594229714efe8be8af70072) (10-01-2025)
- Disable roundcube installation temp [b0ac7d2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b0ac7d2f630ed938ef57bb276114d8158ba99845) (10-01-2025)
- Fix cp after build database [d0197b4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d0197b40487cd5808762044f8ffd5c6d42a044d1) (10-01-2025)
- Doesnt work [7e753af](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7e753afaa5fd14d85a78978343e3c637e1bef221) (10-01-2025)
- Merge branch 'trunk' into feature/e-mail-transfer-policy-dmarc [e1b03ce](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e1b03cee6888c8ad12eb624e79c5d8f51ca2001b) (09-01-2025)
- Merge [f933378](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f93337818381ccb47e4702bd5208aacb69d958b9) (09-01-2025)
- Merge pull request #8 from padcmoi/chore/clean-architecture [6a2f461](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6a2f46138b189ea6a8c3d22060e161a04b359d45) (09-01-2025)
- Force permission on opendkim keys folder [cf0d7a2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/cf0d7a2a97003b2512b773fa11cc0f22b9313359) (09-01-2025)
- Remove some useless features [44c2d58](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/44c2d587cc237797e5fc17196156deff8eff3afe) (09-01-2025)
- Remove some useless features [4c587e6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4c587e6d3f3ecf9570373098878a24fd89be93c0) (09-01-2025)
- Rfc system file and configuration, packages are now created in the Docker image, allowing faster restart/startup. [434045d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/434045de82732146149ce77bde1d941829468f64) (09-01-2025)
- Add original configuration as reference [3a4deb4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3a4deb4a5686e268e113802e6960b16e5ae9c591) (09-01-2025)
- Fix add template folder and removes useless instructions [d53d5f0](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d53d5f0f689ccef4c2f8514183a86ba559725399) (08-01-2025)
- Merge branch 'main' into feature/e-mail-transfer-policy-dmarc [768ee36](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/768ee3638b78d840821c83ef0f61255b8005b9ee) (07-01-2025)
- Check dmarc implementation [4bc24d7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4bc24d709da82470fe5c035dec33b920b440e64d) (07-01-2025)

### Fixed

- Add to environment the key data DMARC_REPORT_HOUR [e83bb10](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e83bb10242d5544da6e55828399a3a111ee7d501) (26-01-2025)
- Multiple bugs before prod [a20a2a5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a20a2a570287e64886a55efe7e4f80d59ff86018) (26-01-2025)
- To avoid fail2ban crashing if these logs dont exist [68f93a0](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/68f93a0c3cd1eb36d2396c33a0d1e3156cec0c4e) (13-01-2025)
- Change default dmarc [a1a457e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a1a457eb2a496320ac9085e0ad65eb88eff9175e) (13-01-2025)
- Moves part dmarc in dedicated file [763d6da](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/763d6daa350506c41d64ca5dd78e3c369b647a81) (12-01-2025)
- Move apache2 concerning rspamd web in 24-rspamd [bf66609](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf6660943e4373b280cd394b927b4f0e700b386b) (11-01-2025)
- Opens a socket to allow applications to add content to the database during the image build [461ec3e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/461ec3e937a828552c45f2d280c524912a881712) (11-01-2025)
- Opens a socket to allow applications to add content to the database during the image build [8612c6f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8612c6f920584ba0c28302330cb740817c86a6bd) (11-01-2025)
- Separates phpmyadmin from the apache2 module as an optional module [002a6a8](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/002a6a8deca764504baf68a1904a5cd85e8a5563) (11-01-2025)
- Separates save spaces from folders destined to become docker volumes [237c204](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/237c204d37219f07427ff070d202206c17b22c48) (11-01-2025)
- Ambigous name password [a394aaa](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a394aaa2f29ab0c04a86432f5d8e3f055f58c3b7) (09-01-2025)
- Issue of permissions on dkim keys once created [7ef64ed](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7ef64ed992f95e02dec01f7dcc3f3d6a2192f625) (09-01-2025)
- Crash postfix boot, permission issues resolved [1ffa9db](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1ffa9db823675257dc1713d98060fbcbd380410f) (09-01-2025)
- Permissions on folders clamav, rspamd [dadd147](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/dadd147955a7c1e362f31eaab071e5d0a40e6be9) (09-01-2025)

[1.1.7]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.5...1.1.7
[1.1.5]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v0.1.0...v1.0.0
