import { Injectable } from '@nestjs/common';
import { DockerService } from './docker.service';

const CONTAINER = 'mail-fail2ban';

@Injectable()
export class Fail2banService {
  constructor(private readonly docker: DockerService) {}

  status() {
    return this.docker.exec(CONTAINER, ['fail2ban-client', 'status']);
  }

  jailStatus(jail: string) {
    return this.docker.exec(CONTAINER, ['fail2ban-client', 'status', this.assertJail(jail)]);
  }

  ban(jail: string, ip: string) {
    return this.docker.exec(CONTAINER, [
      'fail2ban-client',
      'set',
      this.assertJail(jail),
      'banip',
      this.assertIp(ip),
    ]);
  }

  unban(jail: string, ip: string) {
    return this.docker.exec(CONTAINER, [
      'fail2ban-client',
      'set',
      this.assertJail(jail),
      'unbanip',
      this.assertIp(ip),
    ]);
  }

  unbanAll(ip: string) {
    return this.docker.exec(CONTAINER, ['fail2ban-client', 'unban', this.assertIp(ip)]);
  }

  private assertJail(jail: string) {
    if (!/^[a-z0-9_-]{1,64}$/i.test(jail)) throw new Error(`Invalid jail: ${jail}`);
    return jail;
  }

  private assertIp(ip: string) {
    if (!/^[0-9a-f:.]{3,45}$/i.test(ip)) throw new Error(`Invalid IP: ${ip}`);
    return ip;
  }
}
