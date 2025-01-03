# Simply a full docker mail server (MySQL DB)

## DESCRIPTION

### Short

Simply a complete mail server running on a single docker container with as few configuration as possible, quick and easy to set up, fully managed in-house with a MySQL database unreachable from the outside, manageable externally via a nest.js API and a front-end application.

- [Readme installation](INSTALLATION.md) (in progress)
- This project unfinished as long as the PhpMyAdmin is the only way  to manage it (for the moment)

### Concept and why

The inspiration for this project came from the [Docker Mailserver Project](https://github.com/docker-mailserver/docker-mailserver), I started from scratch and wanted to create the same project except with full MySQL email management and simple, easy-to-use configuration for everyone.

I've always wanted to create a complete mail server under Linux with custom administration that is often complex to create, which is why I'd like to take on the challenge of being able to deploy it easily with a docker container that includes all of this and then offer it as an open-source project.

Through this project I'd like to apply what I've learned in my lessons on the [DYMA platform](https://dyma.fr/) (see my objective diagram), [among the DYMA courses](https://dyma.fr/formations) I'd like to apply:

- HTML & CSS
- Tailwind 3
- Linux & Bash
- Docker
- Node
- Typescript
- React (I'd like try that with with next.js)
- React native (maybe, with an app for iOS and Android smartphones)
- NestJS

## Included services, checked for implemented

- [x] [Postfix](http://www.postfix.org) with SASL Dovecot-LMTP authentication
- [x] [Dovecot](https://www.dovecot.org) with SASL, IMAPS only
  - [x] Quota enabled managed by MySQL database
  - [x] Sieve support with basic configuration (see docker/conf/sieve/)
- [x] [Rspamd](https://rspamd.com/)
  - [x] auto bayesian HAM & SPAM
  - [x] Web interface on port 4001 with full spam module configuration
- [x] [Amavis](https://www.amavis.org/)
- [x] [ClamAV](https://www.clamav.net/) with automatic updates
- [ ] [OpenDKIM](http://www.opendkim.org)
- [ ] [OpenDMARC](https://github.com/trusteddomainproject/OpenDMARC)
- [ ] [Fail2ban](https://www.fail2ban.org/wiki/index.php/Main_Page)
- [x] [Postscreen](http://www.postfix.org/POSTSCREEN_README.html)
- [ ] [Postgrey](https://postgrey.schweikert.ch/)
- [ ] ~~[Fetchmail](http://www.fetchmail.info/fetchmail-man.html)~~
- [x] [Roundcube](https://docs.roundcube.net/doc/help/1.1/fr_FR/)
- [x] SSL certificate to be updated on host, letsencrypt compatible, but server doesn't have port 80 to update itself
- [x] MySQL database support
- [ ] API Nest.js written with typescript
- [ ] React front application with ACL support for multiple domains and recipients

## FAQ

### Professional use

There's no reason why this project can't be used by a company, since all the packages used in this project have already been used for many years by professional mail servers.
The Docker container and all its contents can be updated by personal or tierce contributions or by forking the initial project.
Contributions from other developers will allow me to better myself both personally and professionally, that's my goal. However, before using this project, please give me time to finalize it completely.

### Database selection

In the documentation dovecot, postfix, opendmarc etc ..., MySQL plugins seem to be the most optimized.
Postgresql seems optimized for dovecot and postfix but not opendmarc.
It's possible to use mongodb via third-party archives,
I chose to this project MySQL for the advantage of updates and vulnerabilities, which would be fixed more quickly.
Later, I think it would be possible to choose in the environment which type of database by altering the docker configuration files and the bash sed command, it's quite possible and it would be experimental.
I don't think I'd use SQLite because it's limited in terms of writing performance, but PostgreSQL is, and why not mongoDB?

### Choice of linux distribution

Packages are installed with aptitude, so the distribution can be chosen between debian, ubuntu, ...

I've encountered bugs with some distributions, actually I've tested with 2 distributions

- debian 11 (bullseye)
  - OK, All services work except clamav-daemon, but antivirus works on emails
- debian 12 (bookworm)
  - Issues with dovecot quota domain, amavis

## Requirements & installation

###  Requirements

The docker container runs on a VPS 2vcore with 4 GB memory, which seems to be sufficient for working with 10 recipients and 2 domains.
Memory consumption increases with the antivirus, so it depends on the number of recipients and will have to be adjusted if necessary.

###  Installation

There is a document dedicated to this by [clicking here](INSTALLATION.md)

## Tests

At the moment, I don't know how I could set up unit tests, so I'm curious and looking for information.
Unit testing on a docker container, an interesting topic, I wonder if these tests should be performed from the outside or the inside
Example with `docker exec -it simply-mailserver bash`

## License

[MIT License](LICENSE.md)

## Authors

Julien Jean (main contributor)
