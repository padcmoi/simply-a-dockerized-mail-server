import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RootLoginDto {
  @ApiProperty({ example: 'root@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 16 })
  @IsString()
  @MinLength(16)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refresh_token!: string;
}
