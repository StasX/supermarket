import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { DatabaseModule } from './database.module';
import { AuthController } from '../controllers/auth.controller';
import { CartsController } from '../controllers/carts.controller';
import { OrdersController } from '../controllers/orders.controller';
import { ProductsController } from '../controllers/products.controller';
import { AuthService } from '../services/auth.service';
import { ProductsService } from '../services/products.service';
import { CartsService } from '../services/carts.service';
import { CheckoutService } from '../services/checkout.service';
import { SessionGuard } from '../guards/session.guard';
import { ImageStorageService } from '../services/image-storage.service';
import { InvoiceService } from '../services/invoice.service';
import { AuthRateLimitGuard } from '../guards/auth-rate-limit.guard';
import { AuthRateLimitStore } from '../stores/auth-rate-limit.store';
import { CsrfService } from '../services/csrf.service';
import { CsrfGuard } from '../guards/csrf.guard';

@Module({
  imports: [
    DatabaseModule,
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', '..', 'static', 'products'),
        serveRoot: '/products',
        renderPath: '/',
        serveStaticOptions: { index: false, fallthrough: false },
      },
      {
        rootPath: join(__dirname, '..', '..', '..', 'frontend', 'dist', 'browser'),
        serveStaticOptions: { fallthrough: true },
        renderPath: '/',
      },
    ),
  ],
  controllers: [AuthController, CartsController, OrdersController, ProductsController],
  providers: [
    CsrfService,
    CsrfGuard,
    AuthService,
    ProductsService,
    CartsService,
    CheckoutService,
    SessionGuard,
    AuthRateLimitGuard,
    AuthRateLimitStore,
    ImageStorageService,
    InvoiceService,
  ],
})
export class AppModule {}
