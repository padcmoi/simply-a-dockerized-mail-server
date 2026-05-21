import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Reads runtime secrets mounted via docker compose secrets (tmpfs at /run/secrets/).
 * Only the JWT signing secret is consumed by manager-api - root email + password live in the
 * database (Accounts), bootstrapped on the host by install.sh.
 * NEVER leak these via env - process env is exposed by `docker inspect`.
 */
@Injectable()
export class SecretsService {
  readonly rootJwtSecret: string;

  constructor() {
    this.rootJwtSecret = this.read('/run/secrets/root_jwt_secret');
  }

  private read(path: string): string {
    if (!existsSync(path)) {
      throw new Error(
        `Required secret missing at ${path}. ` +
          `Run install.sh on the host to generate .secrets/ then re-create the container.`,
      );
    }
    return readFileSync(path, 'utf8').trim();
  }
}
