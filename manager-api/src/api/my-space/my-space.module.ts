import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VirtualAlias } from "../../core/entities/virtual-alias.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { DomainsAliasesModule } from "../domains/aliases/aliases.module";
import { DomainsRecipientsModule } from "../domains/recipients/recipients.module";
import { MySpaceController } from "./my-space.controller";
import { MySpaceService } from "./my-space.service";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualUser, VirtualAlias]), DomainsRecipientsModule, DomainsAliasesModule],
  providers: [MySpaceService],
  controllers: [MySpaceController],
})
export class MySpaceModule {}
