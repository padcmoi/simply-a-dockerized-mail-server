<?php
// Loaded after the official image's auto-generated config from env vars.

// TLS to internal dovecot / postfix presents the mail.<DOMAIN> cert but
// Roundcube connects by docker service name (dovecot/postfix). Skip CN check.
$config['imap_conn_options'] = [
  'ssl' => [
    'verify_peer'       => false,
    'verify_peer_name'  => false,
    'allow_self_signed' => true,
  ],
];
$config['smtp_conn_options'] = $config['imap_conn_options'];

$config['managesieve_host']         = 'mail-dovecot';
$config['managesieve_port']         = 4190;
$config['managesieve_usetls']       = false;
$config['managesieve_auth_type']    = 'PLAIN';
$config['managesieve_vacation']     = 1;

// Behind a host nginx reverse proxy.
$config['use_https']             = false;
$config['force_https']           = false;
$config['trusted_host_patterns'] = ['.+'];

$config['skin']                   = 'elastic';
$config['language']               = getenv('ROUNDCUBE_LANGUAGE') ?: 'en_US';
$config['default_charset']        = 'UTF-8';
$config['create_default_folders'] = true;
$config['log_driver']             = 'stdout';
