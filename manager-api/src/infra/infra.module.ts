import { Module } from '@nestjs/common';
import { DockerService } from './docker.service';
import { PostfixService } from './postfix.service';
import { OpendkimService } from './opendkim.service';
import { Fail2banService } from './fail2ban.service';
import { RspamdService } from './rspamd.service';
import { DovecotService } from './dovecot.service';
import { LogsService } from './logs.service';

/**
 * Infra control plane - bridge between manager-api and the running docker stack.
 * All consumers REQUIRE role=admin and every action is audited.
 */
@Module({
  providers: [
    DockerService,
    PostfixService,
    OpendkimService,
    Fail2banService,
    RspamdService,
    DovecotService,
    LogsService,
  ],
  exports: [
    DockerService,
    PostfixService,
    OpendkimService,
    Fail2banService,
    RspamdService,
    DovecotService,
    LogsService,
  ],
})
export class InfraModule {}
