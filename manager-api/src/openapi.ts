import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Mounts Swagger UI on /api/doc and the raw OpenAPI JSON on /api/doc-json.
 * Disabled unless SWAGGER_ENABLED=true to keep the surface area minimal in prod.
 */
export function setupOpenApi(app: INestApplication): void {
  const config = app.get(ConfigService);
  if (config.get<string>('SWAGGER_ENABLED') !== 'true') return;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('manager-api')
    .setDescription('Mail server admin API - Auth0 RS256 or local HS256 bearer token')
    .setVersion('1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/doc', app, document, {
    jsonDocumentUrl: 'api/doc-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
