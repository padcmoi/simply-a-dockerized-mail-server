# Simply a full docker mail server (All in One) (MySQL DB)

## DESCRIPTION

### Short

It's a complete multi-domain mail server in an all-in-one container, with all the services for professional use
simplified deployment and configuration this to the 'menu.sh' script, plus an API and web interface for complete platform management with ACLs

### Concept and why

The inspiration for this project came from the [Docker Mailserver Project](https://github.com/docker-mailserver/docker-mailserver). I started from scratch and wanted to create the same project, but with full MySQL-based email management and simplified, easy-to-use configuration for everyone.

When I started this project, I had limited knowledge of mail servers, I read a lot of documentation and tutorials to help me in the creation, I had to make choices during development due to errors and problems, which explains a large number of commits, through this project I increased my experience in this field and if I had to start from 0, I would have thought differently about this architecture, anyway it's a project that will improve over time.

Through this project, I'd like to apply what I've learned in my courses on the [DYMA platform](https://dyma.fr/) (see my objectives diagram), [among the DYMA courses](https://dyma.fr/formations) I'd like to apply :

- HTML & CSS
- Tailwind 3
- Linux & Bash
- Docker
- Node
- Typescript
- React (I'd like try that with with next.js)
- React native (maybe, with an app for iOS and Android smartphones)
- NestJS

## This all-in-one container integrates these services (checked is implemented)

- [x] [Postfix](http://www.postfix.org) with SASL Dovecot-LMTP authentication
- [x] [Dovecot](https://www.dovecot.org) with SASL, IMAPS only
  - [x] Quota enabled managed by MySQL database
  - [x] Sieve support with basic configuration (see docker/conf/sieve/)
- [x] [Rspamd](https://rspamd.com/)
  - [x] auto bayesian HAM & SPAM
  - [x] Web interface on port 4001 with full spam module configuration
  - [x] filtering virus with clamav dedicated module
- [x] [Amavis](https://www.amavis.org/)
- [x] [ClamAV](https://www.clamav.net/) with automatic updates
- [x] [OpenDKIM](http://www.opendkim.org)
- [x] [OpenDMARC](https://github.com/trusteddomainproject/OpenDMARC)
  - [x] script for sending Dmarc reports
- [x] [Fail2ban](https://www.fail2ban.org/wiki/index.php/Main_Page)
- [x] [Postscreen](http://www.postfix.org/POSTSCREEN_README.html)
- [x] [Roundcube](https://docs.roundcube.net/doc/help/1.1/fr_FR/)
- [x] SSL certificate to be updated on host, letsencrypt compatible, but server doesn't have port 80 to update itself
- [x] MySQL database support
- [ ] API Nest.js with ACL support for multiple domains, recipients and business plan
- [ ] React front application

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

## Requirements & installation

###  Requirements

The docker container runs on a VPS 2vcore with 4 GB memory, which seems to be sufficient for working with 10 recipients and 2 domains.
Memory consumption increases with the antivirus, so it depends on the number of recipients and will have to be adjusted if necessary.

###  Installation

I had planned a documentation that I'll produce later. 

I've finalized a tool that allows complete management of the container, except for the creation of DKIM keys, which will have to be done in the container. It's not impossible that I'll add this functionality from the Menu, but it will appear in the API.

The menu allows you to install, configure and use

There is a document dedicated to this by [clicking here](INSTALLATION.md)

## License

[MIT License](LICENSE.md)

## Authors

Julien Jean (main contributor)
