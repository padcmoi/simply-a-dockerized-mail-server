import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Rspamd has its own HTTP API on port 11333 (worker) and 11334 (controller).
 * We hit it directly over the docker network, no docker exec needed.
 */
@Injectable()
export class RspamdService {
  private readonly base = 'http://rspamd:11334';
  private readonly password: string;

  constructor(config: ConfigService) {
    // ADMIN_PASSWORD doubles as Rspamd controller password (set by install.sh in worker-controller.inc).
    this.password = config.get<string>('ADMIN_PASSWORD') ?? '';
  }

  private headers() {
    return { Password: this.password, 'Content-Type': 'application/json' };
  }

  async stat() {
    const res = await fetch(`${this.base}/stat`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Rspamd /stat ${res.status}`);
    return res.json();
  }

  async learnSpam(rawEmail: string) {
    const res = await fetch(`${this.base}/learnspam`, {
      method: 'POST',
      headers: this.headers(),
      body: rawEmail,
    });
    if (!res.ok) throw new Error(`Rspamd /learnspam ${res.status}`);
    return res.json();
  }

  async learnHam(rawEmail: string) {
    const res = await fetch(`${this.base}/learnham`, {
      method: 'POST',
      headers: this.headers(),
      body: rawEmail,
    });
    if (!res.ok) throw new Error(`Rspamd /learnham ${res.status}`);
    return res.json();
  }
}
