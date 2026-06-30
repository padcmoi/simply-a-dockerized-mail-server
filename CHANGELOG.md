# Changelog

fix(ci,tests): align CI seed + test suite with current schema and stack behavior
feat(manager-ui,manager-api): mail volume capacity gauge + i18n FR/EN with typed contract
fix(manager-ui): refresh expired JWT on 401 and stop proxying /api/_nuxt_icon
chore(lint,typecheck): wire eslint + typecheck on both packages, fix all violations
feat(ui,api): v2 dashboard layout + account profile (email, name, avatar)
feat(install,dkim): persist dkim_keys + resumable install.sh
refactor(api): nest resources under /domains/:domainId, rename users -> recipients
feat(health): GET /api/v1/health returns a real cpu/mem/redis/db/mail snapshot
feat(ui): consume /api/v1, swagger moved to /api/doc
feat(manager-api): URI versioning /api/v1 + jwt auth in core/auth/jwt
refactor(manager-api): split src into /api (routes) + /core (shared)
feat(db): typeorm migrations split by business domain + db:* scripts
fix(tests): make roundcube optional, suite green on webmail-less stack
feat(sieve): rename date_creation -> created_at + cover blacklist with a test
ci(actions): bump checkout/upload-artifact to v5 to drop Node 20 deprecation
refactor(compose): split per-service files, optional roundcube overlay
fix(fail2ban): wait for postfix+dovecot logs to exist before booting
ci(mail): github actions workflow runs ./test-mailservers.sh on every branch
docs(changelog): consolidate duplicated Added/Changed/Fixed sections
feat(mail): snake_case tables, user_start_date/user_end_date activity window, dkim_keys table
fix(mail): drop first-mailbox provisioning and stop quota-row stacking
docs(changelog): postmaster reservation + fail2ban/postfix/log-perms fixes
fix(mail): reserve postmaster@<domain> as inactive write-only sender
fix(mail): fail2ban sshd-ddos, postfix lmdb, log perms, drop fail2ban skip
docs(mail): per-feature READMEs under docs/
fix(dovecot): bake dhparam at build time so cold start never trips the healthcheck
chore(redis): bind-mount redis data under ${VOLUMES_PATH}/redis
test(mail): end-to-end mail-server test suite
feat(autorouter): managesieve-visible per-sender auto-routing with system-folder-aware undo
fix(install): enable readline editing on every prompt
fix(install): wrap DKIM TXT value in double quotes in INSTALL_INFO.txt
feat(attachments): unified ATTACHMENT_MAX_SIZE_MB knob (default 25, Gmail parity)
feat(roundcube): enable markasjunk plugin for one-click spam toolbar button
docs(changelog): rspamd/dovecot per-user blocklist + notification + Junk-only policy
feat(dovecot): sa-learn-pipe orchestrator + per-concern hooks + postmaster one-shot
feat(dovecot): imap_sieve + learn-spam/ham sieves with Trash exemption
feat(rspamd): USER_BLOCKLIST + GLOBAL_BLOCKLIST + RECIPIENT_RECORDER lua rules
feat(rspamd): explicit action thresholds, sieve-aligned spam header, greylist off
feat(rspamd): always-on ClamAV antivirus with reject action
feat(rspamd): per-user bayes classifier wired to Redis selector
fix(tls): handle Let's Encrypt rotation inside postfix and dovecot containers (inotify watcher, no host install)
feat(install): install certbot deploy hook that restarts dovecot+postfix on cert renewal
fix(install): parse DKIM sidecar response with python3 instead of grep, emit compact JSON server-side
chore: add prettier (double quotes, semi, es5 trailing, printWidth 130) to manager-api and manager-ui
feat(dkim): manage keys through an opendkim Python sidecar consumed by manager-api and install.sh
feat(install): accept short language aliases (fr, FR, en, ...) for Roundcube locale prompt
chore(compose): dovecot healthcheck + postfix and roundcube wait for service_healthy
fix(sieve): route reject/redirect/vacation bounces through a milter-free internal postfix port
chore: gitignore INSTALL_INFO.txt
docs: rewrite INSTALL.md and update CHANGELOG for the installer overhaul
feat(roundcube): configurable default language via ROUNDCUBE_LANGUAGE
feat(install): one-shot interactive bootstrap with regex-validated prompts
chore(mariadb): split init scripts per database (roundcube, opendmarc)
refactor(manager-api): generate v1-compatible schema via TypeORM synchronize and install triggers via Nest bootstrap hook
fix(manager-api): bump TypeScript to 6.0 to accept ignoreDeprecations 6.0
chore: update CHANGELOG, gitignore and LICENSE for v2
docs: rewrite README, INSTALL and add DOMAIN_DNS for v2 stack
feat(ops): install.sh secret generation and service.sh compose wrapper
feat(manager-ui): Nuxt UI v4 admin pages with Nitro proxy to manager-api
feat(manager-api): JWT auth with refresh tokens backed by Accounts table
feat(manager-api): NestJS scaffold for domains, users, aliases, quotas and sieve
feat(security): fail2ban host-net jails for postfix and dovecot
feat(roundcube): internal docker DNS and plaintext managesieve over bridge
feat(antispam): opendkim, opendmarc, rspamd and clamav images
feat(dovecot): LMTP, IMAPS and managesieve with dict-sql quota
feat(postfix): MySQL-backed virtual delivery with milter chain
feat(mariadb): v1-compatible schema with live quota aggregation triggers
feat: multi-container docker-compose with BINDING_PORT/IP env scheme
chore: drop v1 monolithic stack (Dockerfile, docker-build, libs, webadmin)
chore: add to gitignore
Merge branch 'hotfix/1.1.7'
hotfix v1.1.7
Merge branch 'hotfix/v1.1.5'
fix(fail2ban): records SASL Login failed from postfix only if it has a domain
Merge branch 'hotfix/v1.1.4'
fix: supports 3 auth worker messages
fix(fail2ban): increase test time for postfix rules
fix: excessive auth failed on legitimate connections
Merge branch 'hotfix/v1.1.3'
fix: allow no tls connections
Merge branch 'bugfix/v1.1.2' into develop
refactor: logs are now in true realtime in menu script
style: add a category refactor to changelog
fix: reduces the risk of server crashes due to the antivirus consuming too many resources on a server with too low a memory capacity
fix(fail2ban): removes the ban from log legitime on postfix
Merge tag 'v1.1.1' into develop
Merge branch 'hotfix/v1.1.1'
fix(fail2ban): prevents bots from polluting logs with failed connection attempts
fix(opendmarc): provides the possibility of rejection or acceptation of dmarc evaluation failures, by default to false (before set to true)
fix: adds recursive to copy fail2ban conf folder
fix: add custom postfix fail2ban filter
fix: disable rspamd/greylist causing milter-reject 4.7.1 Try again later on some mails
Adds a menu for complete management, installation and configuration of the docker mail server with ease and simplicity
Adds a menu for complete management, installation and configuration of the docker mail server with ease and simplicity
feat(menu/opendkim): adds MultipleSignatures and MustBeSigned configuration to the menu
fix(opendkim): if an incoming mail has been sent by a misconfigured mail server that doesn't sign with dkim, the default server policy is to refuse, this commit allows you to set the choice to the administrator with a default value of no
fix(opendkim): if an incoming mail has been sent by a misconfigured mail server that doesn't sign with dkim, the default server policy is to refuse, this commit allows you to set the choice to the administrator with a default value of no
fix(opendkim): if an incoming mail has been sent by a misconfigured mail server that doesn't sign with dkim, the default server policy is to refuse, this commit allows you to set the choice to the administrator with a default value of no
Feat: menu implementation for local server installation, configuration and management
Merge branch 'feature/server-management-menu' of https://github.com/padcmoi/simply-a-dockerized-mail-server into feature/server-management-menu
feat: adds menu for configuration, management and installation
fix: add to environment the key data DMARC_REPORT_HOUR
feat: adds menu for configuration, management and installation
fix: multiple bugs before prod
feat: postfix log file in dedicated file or syslog
perf: add firewall rules with ufw and add a basic config
refactor: cleans up architecture for easier upgrades
rfc: Moves docker folder to root folder
feat: customize the path where volumes will be stored
hotfixes: remove stdout 1 to avoid polluting with target mails root@domainFQDN
feat: Adds the ability to enable e-mailing of dmarc reports
hotfixes: Change ambiguous system password
docs: update title
hotfixes: missing reports at 0h
chore: update datetime file, file constantly modified
Merge pull request #13 from padcmoi/debian11-bullseye
Merge pull request #12 from padcmoi/bugfix/mail-server
hotfixes: enable SSL mode for phpmyadmin
hotfixes: fix sql search sql to conf
hotfixes: install roundcube in the image build, to solve the problem of creating databases from APT, add a SQL dump file
hotfixes: dmarc report script didn't work (overwrite)
hotfixes: dmarc report script didn't work
rfc: remove useless mysql command
rfc complete ll command
hotfixes: install opendmarc in the image build, to solve the problem of creating databases from APT, add a SQL dump file
check_policy_service doesn't seem to accept multiple servers, already used by policy-spf
chore: move sample config in parent folder
rfc: Improves the visual appearance of started services
rfc: improve network command
hotfixes: remove duplicate roundcube configuration in apache.conf, this configuration file becomes a site available to activate
fix: To avoid fail2ban crashing if these logs dont exist
fix, show state services
feat: add network utility
rfc: Move services in each setup script, add default configuration to have functional services
rfc: adds run after container in the docker setup sequence
Merge pull request #5 from padcmoi/feature/e-mail-transfer-policy-dmarc
feat: implementation complete of opendmarc, default setup, cron added
feat: add utility reusable
feat: add dmarc report for opendmarc, add a new volume
rfc: connections to postfix milter
fix: change default dmarc
feat: add opendmarc with configuration
docs: remove duplicate element
fix: moves part dmarc in dedicated file
feat: add dmarc configuration with rspamd, disable dkim in rspamd
Merge branch 'trunk' into feature/e-mail-transfer-policy-dmarc
fix: move apache2 concerning rspamd web in 24-rspamd
fix: opens a socket to allow applications to add content to the database during the image build
fix: opens a socket to allow applications to add content to the database during the image build
fix: separates phpmyadmin from the apache2 module as an optional module
rfc: remove the clear command, for better observation
fix: separates save spaces from folders destined to become docker volumes
hotfixes: dovecot permissions issues on etc folder
chore: disable roundcube installation temp
fix cp after build database
chore: doesnt work
Merge branch 'trunk' into feature/e-mail-transfer-policy-dmarc
merge
Merge pull request #8 from padcmoi/chore/clean-architecture
fix: ambigous name password
hotfix: force permission on opendkim keys folder
fix: issue of permissions on dkim keys once created
chore: remove some useless features
chore: remove some useless features
fix: crash postfix boot, permission issues resolved
fix: permissions on folders clamav, rspamd
feat: copies volumes during docker build and renames them in a temporary folder, then reinjects them when the container is launched
rfc system file and configuration, packages are now created in the Docker image, allowing faster restart/startup.
rfc: add original configuration as reference
fix add template folder and removes useless instructions
Merge pull request #6 from padcmoi/feature/security-fail2ban-firewall
feat: customizable jail rules
fix: transfer fail2ban log to syslog, notify ban & unban
feat: implement a firewall and fail2ban to combat brute force attacks
Merge branch 'main' into feature/e-mail-transfer-policy-dmarc
Merge branch 'main' into feature/security-fail2ban-firewall
fix: remove mysql log from syslog and move warn mysql log in dedicated file
check fail2ban implementation
check dmarc implementation
Merge pull request #4 from padcmoi/feature/sign-with-opendkim
fix attempt fix mysql error log
Merge branch 'main' into feature/sign-with-opendkim
fix: add roundcube table to mailuser mysql user
Merge branch 'main' into feature/sign-with-opendkim
disable logs mysql server
rfc: also provides a nice, ready-to-use public key file for sending to DNS
feat: implementation SPF
feat: implementation successful opendkim with antivirus ok
feat: add util command ll
feat: add spf rules
check opendkim
fix api details
disable API instruction (no create) to reduce build time
Merge pull request #3 from padcmoi/feature/migrate-antivirus-filtering-from-amavis-to-rspam
feat: add notification on spam rejection
feat: add clamav rules to rspamd
rfc: remove old amavis
feat: persist clamav database
rfc: remove useless old mail daemon and add tool
fix: syslog missing
Update spam module readme
Update modules added, rspam, postscreen
Merge pull request #1 from padcmoi/feat/spam-implementation
fix: chown errors with unknow vmail user and group
feat: persist config data from rspamd
feat: add spam flag with redirect in spam folder
fix: default sieve rules to new user
fix: enable upstream spam flag
feat: persist redis data from rspamd
feat: implement rspamd web interface
feat: add custom virtual hosts for apache 2 & change access port
fix: add whistlist ip to postscreen
feat: add rspamd with settings & implement Bayesian self-learning ham, spam in dovecot
fix postscreen volume lost after diff merge
resolve conflict from main branch
rfc: move volumes folder to the root project
feat; implement postscreen
Merge branch 'main' into feat/spam-implementation
fix: sql tables numeric values with bigint
fix: roundcube adress imap, smtp server
feat: add update auto certificate script
fix: disable IPV6 & restrictions rules & spamd missing conf
Merge branch 'main' into feat/spam-implementation
feat: implements the ability to enable or disable antivirus
init rspam implement
feat: add postfix volume
feat: add task cron, refresh antivirus
feat: add sieve rules
fix: sieve error on recipient autoresponses
fix: hostname ambigous key by fqdn_domain
feat: add roundcube webmail with basic configuration
fix: provide start ssl cert
feat: Adds functional container with postfix, dovecot, database and configuration
add license
feat: separate dockerfiles in dedicated folder && import repository in docker container
feat: add environnement file at nest api
Create README.md
initial commit
