import { Module } from "@nestjs/common";
import { DkimService } from "./dkim.service";

@Module({
  providers: [DkimService],
  exports: [DkimService],
})
export class DkimModule {}
