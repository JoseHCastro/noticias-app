import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar cookie parser para OAuth
  app.use(cookieParser());

  // Habilitar CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT) || 3000;
  const server = await app.listen(port);
  server.setTimeout(300000); // 5 minutos de timeout
  console.log(`Servidor corriendo en http://localhost:${port}`);
}
bootstrap();
