import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional } from 'class-validator';

const ROLES = ['root', 'admin', 'owner', 'user'] as const;

export class UpdateWebadminAccountDto {
  @ApiProperty({ required: false, enum: ROLES })
  @IsOptional()
  @IsEnum(ROLES)
  role?: (typeof ROLES)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  account_id?: number;

  @ApiProperty({ required: false, description: '0 or 1' })
  @IsOptional()
  @IsInt()
  is_active?: number;
}
