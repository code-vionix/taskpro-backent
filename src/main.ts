import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'], // Only show errors and warnings from Nest itself
  });
  app.enableCors(); // Enable CORS for the frontend
  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`\x1b[32m Application is running on: http://localhost:${port}\x1b[0m`);
}
bootstrap();
