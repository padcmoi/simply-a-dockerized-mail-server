Simply a mail server with as few configuration files as possible



Included services

- [Postfix](http://www.postfix.org) with SMTP or LDAP authentication and support for [extension delimiters](https://docker-mailserver.github.io/docker-mailserver/latest/config/account-management/overview/#aliases)
- [Dovecot](https://www.dovecot.org) with SASL, IMAP, POP3, LDAP, [basic Sieve support](https://docker-mailserver.github.io/docker-mailserver/latest/config/advanced/mail-sieve) and [quotas](https://docker-mailserver.github.io/docker-mailserver/latest/config/user-management/#quotas)
- [Rspamd](https://rspamd.com/)
- [Amavis](https://www.amavis.org/)
- [SpamAssassin](http://spamassassin.apache.org/) supporting custom rules
- [ClamAV](https://www.clamav.net/) with automatic updates
- [OpenDKIM](http://www.opendkim.org) & [OpenDMARC](https://github.com/trusteddomainproject/OpenDMARC)
- [Fail2ban](https://www.fail2ban.org/wiki/index.php/Main_Page)
- [Fetchmail](http://www.fetchmail.info/fetchmail-man.html)
- [Getmail6](https://getmail6.org/documentation.html)
- [Postscreen](http://www.postfix.org/POSTSCREEN_README.html)
- [Postgrey](https://postgrey.schweikert.ch/)
- Support for [LetsEncrypt](https://letsencrypt.org/), manual and self-signed certificates
- Mailserver managed by local MySQL database
- API 
