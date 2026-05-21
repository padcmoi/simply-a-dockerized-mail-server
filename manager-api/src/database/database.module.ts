import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        // Schema is sacred - never let TypeORM touch existing tables
        synchronize: false,
        migrationsRun: false,
        entities: Object.values(entities),
        charset: 'utf8_general_ci',
        timezone: 'Z',
        extra: {
          // mysql2-specific - avoids large bigint -> Number precision loss
          supportBigNumbers: true,
          bigNumberStrings: false,
        },
        logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
