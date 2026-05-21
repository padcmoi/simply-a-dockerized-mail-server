import { Global, Module } from '@nestjs/common';
import { Sha512CryptService } from './sha512-crypt.service';
import { SecretsService } from './secrets.service';

@Global()
@Module({
  providers: [Sha512CryptService, SecretsService],
  exports: [Sha512CryptService, SecretsService],
})
export class CommonModule {}
