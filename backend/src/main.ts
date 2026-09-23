import type { Request, Response, NextFunction } from 'express';
import { authContext } from './auth/auth-context';
import { AuthGuard } from './auth/auth.guard';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use((_req: Request, _res: Response, next: NextFunction) =>
    authContext.run({}, next),
  );
  app.useGlobalGuards(new AuthGuard());
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('SAVE API')
    .setDescription('Core API for the SAVE finance platform')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
