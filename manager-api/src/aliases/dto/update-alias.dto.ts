import { PartialType } from '@nestjs/swagger';
import { CreateAliasDto } from './create-alias.dto';

export class UpdateAliasDto extends PartialType(CreateAliasDto) {}
