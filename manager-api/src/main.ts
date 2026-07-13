import { NestFactory } from "@nestjs/core";
import { VersioningType } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });
  // The API only ever runs behind the Nuxt proxy / a reverse proxy, so the raw
  // socket address is always an internal hop (the Docker gateway). Trust the
  // proxy chain so `@Ip()` / req.ip reads the real client address from
  // X-Forwarded-For -- this is what session rows record and show back to the
  // user. Requires the fronting proxy to forward X-Forwarded-For (Nuxt's nitro
  // proxy and the public reverse proxy both do).
  app.set("trust proxy", true);
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.enableCors({ origin: true, credentials: true });

  const swagger = new DocumentBuilder()
    .setTitle("Simply Mail Server - Manager API")
    .setDescription("REST API for managing domains, mailboxes, aliases, quotas and sieve rules.")
    .setVersion("1.0.0")
    .addApiKey(
      { type: "apiKey", in: "header", name: "X-Api-Key", description: "Full API token: sms_clientId.secret" },
      "apiToken"
    )
    .build();
  SwaggerModule.setup("api/doc", app, SwaggerModule.createDocument(app, swagger));

  await app.listen(Number(process.env.MANAGER_API_PORT ?? 3000), "0.0.0.0");
}
bootstrap();
