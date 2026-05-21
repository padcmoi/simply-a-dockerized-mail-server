import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSieveRejectDto {
  @ApiProperty({
    example: '@spammy-domain.com',
    description: 'Pattern matched against the sender (e.g. full email or `@domain` wildcard)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  sender!: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  enabled = 1;
}
