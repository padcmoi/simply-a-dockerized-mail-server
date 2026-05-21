import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateDomainDto {
  @ApiProperty({ example: 'naskot.fr' })
  @Matches(/^[a-z0-9.-]{1,253}$/i, { message: 'domain must be a valid FQDN' })
  domain!: string;

  @ApiProperty({ example: 1073741824, description: 'Domain quota in bytes, 0 = unlimited' })
  @IsInt()
  @Min(0)
  quota = 0;

  @ApiProperty({ example: 1, description: '1 = active, 0 = disabled' })
  @IsInt()
  @Min(0)
  active = 1;

  @ApiProperty({ required: false, description: 'Account.id of the domain owner' })
  @IsOptional()
  @IsInt()
  owner_id?: number;

  @ApiProperty({ required: false, example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  user_start_date?: string;

  @ApiProperty({ required: false, example: '2027-01-01' })
  @IsOptional()
  @IsDateString()
  user_end_date?: string;
}
