import { Injectable } from '@nestjs/common';
import { DockerService } from './docker.service';

const CONTAINER = 'mail-opendkim';

/**
 * DKIM key lifecycle. Selectors follow the 1.x.x convention `dkim_YYYY_MM`.
 * After genkey, the caller must update opendkim KeyTable/SigningTable/TrustedHosts
 * and reload opendkim - this service exposes the raw operations.
 */
@Injectable()
export class OpendkimService {
  constructor(private readonly docker: DockerService) {}

  /** Create a new 2048-bit RSA key for the domain. Returns the .txt DNS record content. */
  async createKey(domain: string, selector: string) {
    const safeDomain = this.assertDomain(domain);
    const safeSelector = this.assertSelector(selector);
    const dir = `/etc/opendkim/keys/${safeDomain}`;
    await this.docker.exec(CONTAINER, ['mkdir', '-p', dir]);
    await this.docker.exec(CONTAINER, [
      'opendkim-genkey',
      '-b',
      '2048',
      '-d',
      safeDomain,
      '-s',
      safeSelector,
      '-D',
      dir,
    ]);
    await this.docker.exec(CONTAINER, [
      'chown',
      'opendkim:opendkim',
      `${dir}/${safeSelector}.private`,
    ]);
    await this.docker.exec(CONTAINER, ['chmod', '600', `${dir}/${safeSelector}.private`]);
    return this.docker.exec(CONTAINER, ['cat', `${dir}/${safeSelector}.txt`]);
  }

  reload() {
    return this.docker.exec(CONTAINER, ['service', 'opendkim', 'reload']);
  }

  private assertDomain(domain: string) {
    if (!/^[a-z0-9.-]{1,253}$/i.test(domain)) {
      throw new Error(`Invalid domain: ${domain}`);
    }
    return domain;
  }

  private assertSelector(selector: string) {
    if (!/^[a-z0-9_-]{1,63}$/i.test(selector)) {
      throw new Error(`Invalid selector: ${selector}`);
    }
    return selector;
  }
}
