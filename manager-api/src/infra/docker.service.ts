import { Injectable, Logger } from '@nestjs/common';
import Docker from 'dockerode';

/**
 * Thin wrapper around dockerode. Single instance, points at /var/run/docker.sock.
 * Consumers should use the higher-level service classes (PostfixService etc.) and not this directly.
 */
@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);
  private readonly docker = new Docker({ socketPath: '/var/run/docker.sock' });

  getContainer(name: string) {
    return this.docker.getContainer(name);
  }

  /**
   * Exec a whitelisted command inside a container, capture stdout.
   * Returns the combined stdout/stderr text. Throws on non-zero exit.
   */
  async exec(containerName: string, cmd: string[]): Promise<string> {
    const container = this.docker.getContainer(containerName);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve());
      stream.on('error', (e: Error) => reject(e));
    });
    const output = Buffer.concat(chunks).toString('utf8');
    const inspectResult = await exec.inspect();
    if (inspectResult.ExitCode !== 0) {
      throw new Error(
        `docker exec ${containerName} ${cmd.join(' ')} exited ${inspectResult.ExitCode}: ${output}`,
      );
    }
    this.logger.debug(`exec ${containerName} ${cmd.join(' ')} -> OK`);
    return output;
  }
}
