import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  app.setGlobalPrefix("api");
  app.enableCors({ origin: true, credentials: true });

  const swagger = new DocumentBuilder()
    .setTitle("Simply Mail Server - Manager API")
    .setDescription("REST API for managing domains, mailboxes, aliases, quotas and sieve rules.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger));

  await app.listen(Number(process.env.MANAGER_API_PORT ?? 3000), "0.0.0.0");
}
bootstrap();
