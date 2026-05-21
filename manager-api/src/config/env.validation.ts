import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvVars {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsInt()
  PORT!: number;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsInt()
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  // Auth0 - RS256 token validation via JWKS
  @IsString()
  @IsNotEmpty()
  AUTH0_DOMAIN!: string;

  @IsString()
  @IsNotEmpty()
  AUTH0_AUDIENCE!: string;

  @IsUrl({ require_tld: false })
  AUTH0_ISSUER!: string;

  // Mail server FQDN - used by manager-api when computing DNS records for a new domain
  @IsString()
  @IsNotEmpty()
  DOMAIN_FQDN!: string;

  // Root token lifetimes - the credentials themselves live in docker secrets, NOT in env.
  @IsOptional()
  @IsString()
  ROOT_JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  ROOT_REFRESH_EXPIRES_IN?: string;

  @IsOptional()
  @IsInt()
  THROTTLE_TTL?: number;

  @IsOptional()
  @IsInt()
  THROTTLE_LIMIT?: number;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsBooleanString()
  SWAGGER_ENABLED?: string;
}

export function validateEnv(raw: Record<string, unknown>) {
  const parsed = plainToInstance(EnvVars, raw, { enableImplicitConversion: true });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${messages}`);
  }
  return parsed;
}
