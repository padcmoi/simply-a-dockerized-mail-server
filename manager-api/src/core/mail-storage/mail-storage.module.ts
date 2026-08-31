import { Module } from "@nestjs/common";
import { MailStorageService } from "./mail-storage.service";

@Module({
  providers: [MailStorageService],
  exports: [MailStorageService],
})
export class MailStorageModule {}
