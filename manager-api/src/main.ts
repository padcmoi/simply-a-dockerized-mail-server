import { NestFactory } from "@nestjs/core";
import { VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
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
