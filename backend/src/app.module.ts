import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { DatabaseModule } from './database.module';
import { ApiController } from './api.controller';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { SessionGuard } from './session.guard';
import { ImageStorageService } from './image-storage.service';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [DatabaseModule, ServeStaticModule.forRoot({
    rootPath: join(__dirname, '..', 'static', 'products'),
    serveRoot: '/products',
    renderPath: '/',
    serveStaticOptions: { index: false, fallthrough: false },
  }, {
    rootPath: join(__dirname, '..', '..', 'frontend', 'dist', 'browser'),
    serveStaticOptions: { fallthrough: true },
    renderPath: '/',
  })],
  controllers: [ApiController],
  providers: [AuthService, ShopService, SessionGuard, ImageStorageService, InvoiceService],
})
export class AppModule {}
