<?php

class fail2ban extends rcube_plugin
{
    public const DENY_DIR = '/var/lib/fail2ban-deny';
    public const FAILURE_LOG = '/var/log/roundcube/failures.log';

    public function init()
    {
        $this->add_hook('startup', [$this, 'refuse_banned']);
        $this->add_hook('login_failed', [$this, 'record_failure']);
    }

    public function refuse_banned($args)
    {
        $ip = rcube_utils::remote_addr();
        if ($ip !== '' && self::is_banned($ip)) {
            http_response_code(403);
            header('Content-Type: text/plain; charset=utf-8');
            header('Cache-Control: no-store');
            echo "403 Forbidden\n";
            exit;
        }

        return $args;
    }

    public function record_failure($args)
    {
        $ip = rcube_utils::remote_addr();
        if ($ip === '' || !is_writable(self::FAILURE_LOG)) {
            return $args;
        }

        $user = preg_replace('/[^\x21-\x7E]/', '?', (string) ($args['user'] ?? ''));
        $line = sprintf("%s %s failed login for %s\n", gmdate('Y-m-d H:i:s'), $ip, substr($user, 0, 128));
        @file_put_contents(self::FAILURE_LOG, $line, FILE_APPEND | LOCK_EX);

        return $args;
    }

    public static function is_banned(string $ip): bool
    {
        foreach (glob(self::DENY_DIR . '/*.deny') ?: [] as $file) {
            $banned = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (is_array($banned) && in_array($ip, array_map('trim', $banned), true)) {
                return true;
            }
        }

        return false;
    }
}
