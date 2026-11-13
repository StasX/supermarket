import { Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import mongoose from 'mongoose';
import User = require('./models/User');
import Product = require('./models/Product');
import Cart = require('./models/Cart');
import Order = require('./models/Order');

export const MODELS = 'MODELS';

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await mongoose.disconnect();
  }
}

@Module({
  providers: [
    DatabaseLifecycle,
    {
      provide: MODELS,
      useFactory: async () => {
        await mongoose.connect(process.env['MONGODB_URI'] || 'mongodb://localhost:27017/shop');
        // Do not accept requests until MongoDB enforces one open cart per user.
        await Cart.createIndexes();
        await Order.createIndexes();
        return {
          users: User,
          products: Product,
          carts: Cart,
          orders: Order,
        };
      },
    },
  ],
  exports: [MODELS],
})
export class DatabaseModule {}
