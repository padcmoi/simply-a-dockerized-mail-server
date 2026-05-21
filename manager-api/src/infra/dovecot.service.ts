import { Injectable } from '@nestjs/common';
import { DockerService } from './docker.service';

const CONTAINER = 'mail-dovecot';

@Injectable()
export class DovecotService {
  constructor(private readonly docker: DockerService) {}

  reload() {
    return this.docker.exec(CONTAINER, ['doveadm', 'reload']);
  }

  /** Force-sync a user's mailbox storage from disk (after manual maildir edits). */
  quotaRecalc(email: string) {
    if (!/^[a-z0-9._+-]+@[a-z0-9.-]+$/i.test(email)) throw new Error(`Invalid email: ${email}`);
    return this.docker.exec(CONTAINER, ['doveadm', 'quota', 'recalc', '-u', email]);
  }

  /** Compile a user-supplied sieve script (returns stdout, errors are thrown). */
  compileSieve(absolutePath: string) {
    if (!/^\/var\/mail\/vhosts\/[^/]+\/[^/]+\/[a-z0-9._-]+$/i.test(absolutePath)) {
      throw new Error(`Sieve path must live under /var/mail/vhosts: ${absolutePath}`);
    }
    return this.docker.exec(CONTAINER, ['sievec', absolutePath]);
  }
}
