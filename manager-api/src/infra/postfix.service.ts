import { Injectable } from '@nestjs/common';
import { DockerService } from './docker.service';

const CONTAINER = 'mail-postfix';

@Injectable()
export class PostfixService {
  constructor(private readonly docker: DockerService) {}

  reload() {
    return this.docker.exec(CONTAINER, ['postfix', 'reload']);
  }

  flushQueue() {
    return this.docker.exec(CONTAINER, ['postfix', 'flush']);
  }

  mailq() {
    return this.docker.exec(CONTAINER, ['mailq']);
  }

  deleteQueueId(queueId: string) {
    // queueId is sanitized at the controller level (DTO with regex).
    return this.docker.exec(CONTAINER, ['postsuper', '-d', queueId]);
  }

  deleteAll() {
    return this.docker.exec(CONTAINER, ['postsuper', '-d', 'ALL']);
  }
}
