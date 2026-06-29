import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DkimKeyEntity } from "./dkim-key.entity";
import { DkimService } from "./dkim.service";

@Module({
  imports: [TypeOrmModule.forFeature([DkimKeyEntity])],
  providers: [DkimService],
  exports: [DkimService],
})
export class DkimModule {}
