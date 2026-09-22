import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppSetting } from "../entities/app-setting.entity";
import { DmarcEvaluation } from "../entities/dmarc-evaluation.entity";
import { DmarcInboxMessage } from "../entities/dmarc-inbox-message.entity";
import { DmarcIncomingRecord } from "../entities/dmarc-incoming-record.entity";
import { DmarcIncomingReport } from "../entities/dmarc-incoming-report.entity";
import { DmarcOutgoingReport } from "../entities/dmarc-outgoing-report.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { VirtualUser } from "../entities/virtual-user.entity";
import { DmarcImapService } from "./dmarc-imap.service";
import { DmarcInboxService } from "./dmarc-inbox.service";
import { DmarcIngestService } from "./dmarc-ingest.service";
import { DmarcMailerService } from "./dmarc-mailer.service";
import { DmarcMailboxService } from "./dmarc-mailbox.service";
import { DmarcPslService } from "./dmarc-psl.service";
import { DmarcRecipientsService } from "./dmarc-recipients.service";
import { DmarcReporterService } from "./dmarc-reporter.service";
import { DmarcSchedulerService } from "./dmarc-scheduler.service";
import { DmarcSettingsService } from "./dmarc-settings.service";
import { DmarcService } from "./dmarc.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DmarcEvaluation,
      DmarcOutgoingReport,
      DmarcIncomingReport,
      DmarcIncomingRecord,
      DmarcInboxMessage,
      AppSetting,
      VirtualUser,
      VirtualDomain,
    ]),
  ],
  providers: [
    DmarcSettingsService,
    DmarcIngestService,
    DmarcRecipientsService,
    DmarcPslService,
    DmarcMailerService,
    DmarcReporterService,
    DmarcImapService,
    DmarcInboxService,
    DmarcSchedulerService,
    DmarcMailboxService,
    DmarcService,
  ],
  exports: [DmarcService],
})
export class DmarcCoreModule {}
