import 'reflect-metadata';
import './load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
const cookieParser = require('cookie-parser');

export async function createApp(rootModule = AppModule) {
  const app = await NestFactory.create(rootModule, { logger: ['error', 'warn', 'log'] });
  app.use(cookieParser());
  app.enableShutdownHooks();
  return app;
}

if (require.main === module) {
  createApp().then(app => app.listen(process.env['PORT'] || 3000, '0.0.0.0')).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
