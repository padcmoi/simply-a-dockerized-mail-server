import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAliasDto {
  @ApiProperty({ example: 'naskot.fr' })
  @IsString()
  domain!: string;

  @ApiProperty({ example: 'contact@naskot.fr' })
  @IsEmail()
  source!: string;

  @ApiProperty({ example: 'admin@naskot.fr' })
  @IsEmail()
  destination!: string;

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
