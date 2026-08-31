import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { access, constants, rm } from "fs/promises";
import { isAbsolute, join, relative, resolve } from "path";

// Dovecot's `mail_location = maildir:/var/mail/vhosts/%d/%n/` (see
// images/dovecot/conf/conf.d/10-mail.conf) is the single source of truth for
// this layout, and `virtual_users.maildir` already stores the `<domain>/<local>/`
// half of it. MAIL_VOLUME_PATH is the same env var domains.service.ts stats for
// free space, and the volume is mounted read-write for manager-api precisely so
// deleting a domain or a recipient can take its mail with it.
const VHOSTS_DIR = "vhosts";

@Injectable()
export class MailStorageService implements OnModuleInit {
  private readonly log = new Logger(MailStorageService.name);

  private get volumeRoot() {
    return process.env.MAIL_VOLUME_PATH ?? "/var/mail";
  }

  private get vhostsRoot() {
    return join(this.volumeRoot, VHOSTS_DIR);
  }

  // Refuse to boot on a read-only mail volume. This service is the only thing
  // that erases a deleted mailbox's mail, and a failed `rm` is not something a
  // caller can react to: the database row is already gone by then, so the
  // deletion reports success while the mail quietly stays on disk forever.
  // Better a crash loop naming the exact fix than a mail server that keeps the
  // mail of accounts it swears it deleted. `/var/mail` is checked rather than
  // `vhosts/`, which dovecot may not have created yet on a cold start.
  async onModuleInit() {
    try {
      await access(this.volumeRoot, constants.W_OK);
    } catch {
      const msg =
        `${this.volumeRoot} is not writable. Deleting a domain or a recipient could not erase its mail. ` +
        `Mount it read-write for manager-api (drop the ":ro" flag in docker/services/manager-api.yml) ` +
        `and recreate the container -- a mount mode does not change on a plain restart.`;
      this.log.error(msg);
      throw new Error(msg);
    }
  }

  // Everything below is a `rm -rf` running as root, so the path it is handed
  // decides what survives. `maildir` and `domain` come from our own database
  // rather than from a request body, but a column is not a guarantee: one bad
  // migration, one seed written by hand, one `..` and this deletes the volume.
  // So the resolved path is proven to sit strictly *under* vhosts/ before any
  // removal, and the root itself is never an acceptable target.
  private safeResolve(segment: string): string | null {
    const root = this.vhostsRoot;
    const target = resolve(root, segment);
    const rel = relative(root, target);
    if (rel === "") {
      this.log.error(`Refusing to remove ${target}: that is the vhosts root itself`);
      return null;
    }
    if (rel.startsWith("..") || isAbsolute(rel)) {
      this.log.error(`Refusing to remove ${target}: outside ${root}`);
      return null;
    }
    return target;
  }

  // Called after the database row is already gone. A directory that never
  // existed is the normal case for a mailbox dovecot never delivered to, so
  // ENOENT is silence, not an error. Any other failure is logged loudly and
  // swallowed: the row is deleted either way, and a leftover directory is
  // recoverable by hand, whereas throwing here would report a delete that in
  // fact succeeded as a failure.
  private async removeTree(target: string | null, label: string) {
    if (target === null) return false;
    try {
      await rm(target, { recursive: true, force: true });
      this.log.log(`Removed maildir for ${label}: ${target}`);
      return true;
    } catch (e) {
      this.log.error(`Failed to remove maildir for ${label} (${target}): ${(e as Error).message}`);
      return false;
    }
  }

  // /var/mail/vhosts/<domain>/ -- the whole tree, every mailbox of the domain.
  removeDomain(domain: string) {
    return this.removeTree(this.safeResolve(domain), `domain ${domain}`);
  }

  // /var/mail/vhosts/<domain>/<local-part>/ -- `maildir` is stored with a
  // trailing slash (`example.com/jdoe/`), which resolve() normalizes away.
  removeRecipient(maildir: string, email: string) {
    return this.removeTree(this.safeResolve(maildir), `recipient ${email}`);
  }
}
