import { Injectable } from '@nestjs/common';
import { DockerService } from './docker.service';

@Injectable()
export class LogsService {
  constructor(private readonly docker: DockerService) {}

  /** Returns the last `tail` lines of a container's logs (stdout+stderr). */
  async tail(containerName: string, tail = 200) {
    if (!/^[a-z0-9_-]{1,64}$/i.test(containerName))
      throw new Error(`Invalid container name: ${containerName}`);
    const container = this.docker.getContainer(containerName);
    const buffer = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
    return Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer);
  }
}
