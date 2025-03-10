<?php

/*
+-----------------------------------------------------------------------+
| Local configuration for the Roundcube Webmail installation.           |
|                                                                       |
| This is a sample configuration file only containing the minimum       |
| setup required for a functional installation. Copy more options       |
| from defaults.inc.php to this file to override the defaults.          |
|                                                                       |
| This file is part of the Roundcube Webmail client                     |
| Copyright (C) The Roundcube Dev Team                                  |
|                                                                       |
| Licensed under the GNU General Public License version 3 or            |
| any later version with exceptions for skins & plugins.                |
| See the README file for a full license statement.                     |
+-----------------------------------------------------------------------+
 */

$config = array();

// Do not set db_dsnw here, use dpkg-reconfigure roundcube-core to configure database!
include_once "/etc/roundcube/debian-db-roundcube.php";

// The IMAP host chosen to perform the log-in.
// Leave blank to show a textbox at login, give a list of hosts
// to display a pulldown menu or set one host as string.
// Enter hostname with prefix ssl:// to use Implicit TLS, or use
// prefix tls:// to use STARTTLS.
// Supported replacement variables:
// %n - hostname ($_SERVER['SERVER_NAME'])
// %t - hostname without the first part
// %d - domain (http hostname $_SERVER['HTTP_HOST'] without the first part)
// %s - domain name after the '@' from e-mail address provided at login screen
// For example %n = mail.domain.tld, %t = domain.tld
$config['default_host'] = 'tls://____domainFQDN';

// SMTP server host (for sending mails).
// Enter hostname with prefix ssl:// to use Implicit TLS, or use
// prefix tls:// to use STARTTLS.
// Supported replacement variables:
// %h - user's IMAP hostname
// %n - hostname ($_SERVER['SERVER_NAME'])
// %t - hostname without the first part
// %d - domain (http hostname $_SERVER['HTTP_HOST'] without the first part)
// %z - IMAP domain (IMAP hostname without the first part)
// For example %n = mail.domain.tld, %t = domain.tld
$config['smtp_server'] = 'tls://____domainFQDN';

// SMTP port. Use 25 for cleartext, 465 for Implicit TLS, or 587 for STARTTLS (default)
$config['smtp_port'] = 587;

// SMTP username (if required) if you use %u as the username Roundcube
// will use the current username for login
$config['smtp_user'] = '%u';

// SMTP password (if required) if you use %p as the password Roundcube
// will use the current user's password for login
$config['smtp_pass'] = '%p';

// provide an URL where a user can get support for this Roundcube installation
// PLEASE DO NOT LINK TO THE ROUNDCUBE.NET WEBSITE HERE!
$config['support_url'] = '';

// Name your service. This is displayed on the login screen and in the window title
$config['product_name'] = 'Roundcube Webmail';

// This key is used to encrypt the users imap password which is stored
// in the session record. For the default cipher method it must be
// exactly 24 characters long.
// YOUR KEY MUST BE DIFFERENT THAN THE SAMPLE VALUE FOR SECURITY REASONS
$config['des_key'] = '____ROUNDCUBE_DES_KEY';

// List of active plugins (in plugins/ directory)
// Debian: install roundcube-plugins first to have any
$config['plugins'] = array(
);

// skin name: folder from skins/
$config['skin'] = 'elastic';

// Disable spellchecking
// Debian: spellchecking needs additional packages to be installed, or calling external APIs
//         see defaults.inc.php for additional informations
$config['enable_spellcheck'] = false;

// TODO SSL ?
# specify IMAP port (STARTTLS setting)
$config['default_port'] = 143;

# specify SMTP auth type
$config['smtp_auth_type'] = 'LOGIN';

# specify SMTP HELO host
$config['smtp_helo_host'] = '____domainFQDN';

# specify domain name
// TODO should be an array, to be defined later
// $config['mail_domain'] = '____domainFQDN';

# specify UserAgent
$config['useragent'] = 'Roundcube Webmail/' . RCUBE_VERSION;

# specify SMTP and IMAP connection option
$config['imap_conn_options'] = array(
    'ssl' => array(
        'verify_peer' => true,
        'CN_match' => '____domainFQDN',
        'allow_self_signed' => true,
        'ciphers' => 'HIGH:!SSLv2:!SSLv3',
    ),
);
$config['smtp_conn_options'] = array(
    'ssl' => array(
        'verify_peer' => true,
        'CN_match' => '____domainFQDN',
        'allow_self_signed' => true,
        'ciphers' => 'HIGH:!SSLv2:!SSLv3',
    ),
);

// List of active plugins (in plugins/ directory)
// Debian: install roundcube-plugins first to have any
$config['plugins'] = array(
    'acl', 'additional_message_headers', 'archive', 'attachment_reminder', 'autologon',
    'debug_logger', 'emoticons', 'enigma', 'filesystem_attachments', 'help', 'hide_blockquote',
    'http_authentication', 'identicon', 'identity_select', 'jqueryui', 'krb_authentication',
    'managesieve', 'markasjunk', 'new_user_dialog', 'new_user_identity', 'newmail_notifier',
    'password', 'reconnect', 'redundant_attachments', 'show_additional_headers', 'squirrelmail_usercopy',
    'subscriptions_option', 'userinfo', 'vcard_attachments', 'virtuser_file', 'virtuser_query', 'zipdownload',
);
