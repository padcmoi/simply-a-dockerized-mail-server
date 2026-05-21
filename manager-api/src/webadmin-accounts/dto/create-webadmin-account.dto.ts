import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const ROLES = ['root', 'admin', 'owner', 'user'] as const;

export class CreateWebadminAccountDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: ROLES, default: 'user' })
  @IsEnum(ROLES)
  role!: (typeof ROLES)[number];

  @ApiProperty({ required: false, description: 'Account.id for owner/user roles' })
  @IsOptional()
  @IsInt()
  account_id?: number;
}
