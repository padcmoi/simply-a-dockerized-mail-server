import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'julien', description: 'Domain owner username (FK target)' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  username!: string;
}
