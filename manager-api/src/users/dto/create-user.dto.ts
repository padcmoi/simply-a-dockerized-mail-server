import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'alice@naskot.fr' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'naskot.fr' })
  @IsString()
  @MaxLength(255)
  domain!: string;

  @ApiProperty({ description: 'Cleartext, will be SHA512-CRYPT hashed', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'naskot.fr/alice/', description: 'Maildir path under /var/mail/vhosts/' })
  @IsString()
  @MaxLength(50)
  maildir!: string;

  @ApiProperty({ example: 524288000, description: 'User quota in bytes, 0 = unlimited' })
  @IsInt()
  @Min(0)
  quota = 0;

  @ApiProperty({ example: 1 })
  @IsInt()
  active = 1;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  owner_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  user_start_date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  user_end_date?: string;
}
