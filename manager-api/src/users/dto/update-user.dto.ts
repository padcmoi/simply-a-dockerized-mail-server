import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// Password is updated via a dedicated endpoint to keep the hashing path explicit.
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {}
