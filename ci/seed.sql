-- Seed for the CI mail-server job, see .github/workflows/test.yml.
--
-- Nothing is interpolated into this file. The workflow prepends a single
-- `SET @... = '...'` statement and pipes the whole thing to the mariadb
-- client, so a hash carrying `$`, `/` or `.` can never break out of a SQL
-- literal, and this file stays readable SQL that an editor can lint.
--
-- Expected session variables:
--   @admin_email      the root account's login email
--   @admin_hash       scrypt hash of the admin password
--   @primary_domain   the FQDN under test
--   @postmaster_hash  sha512-crypt hash, never used to log in

-- `accounts.id` is a char(36) uuid the application generates on insert (see
-- Account.generateId), so the column has no database default and any seed
-- written outside the app must supply one. The account is identified by email
-- (username/name/avatar_url were dropped in 1783882664787) and its personal
-- attributes live in a 1-1 account_profiles row, so a second statement gives
-- it an (empty) profile via a by-email id lookup, mirroring install.sh.
INSERT INTO accounts (id, email, password, is_root, enabled, created_at, updated_at)
VALUES (UUID(), @admin_email, @admin_hash, 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE password = VALUES(password), updated_at = NOW();

INSERT IGNORE INTO account_profiles (account_id, created_at, updated_at)
SELECT id, NOW(), NOW() FROM accounts WHERE email = @admin_email;

-- The quota triggers of 1782760166966-CreateVirtualMail fill virtual_quota_*
-- on their own; INSERT IGNORE keeps a re-run from tripping over them.
INSERT IGNORE INTO virtual_domains (domain, quota, active)
VALUES (@primary_domain, 10737418240, 1);

-- postmaster@<domain> exists but stays inactive with quota 0: it is the
-- envelope-from dovecot-lda uses for system notifications, never a real
-- mailbox. DomainsService.reservePostmaster does the same thing at runtime.
INSERT INTO virtual_users (domain, email, password, maildir, quota, active)
VALUES (
  @primary_domain,
  CONCAT('postmaster@', @primary_domain),
  @postmaster_hash,
  CONCAT(@primary_domain, '/postmaster/'),
  0,
  0
)
ON DUPLICATE KEY UPDATE active = 0;
