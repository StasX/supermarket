import { Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import mongoose from 'mongoose';
import User = require('../models/User');
import Product = require('../models/Product');
import Cart = require('../models/Cart');
import Order = require('../models/Order');
import RevokedSession = require('../models/RevokedSession');

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
        await User.createIndexes();
        await Product.createIndexes();
        // Do not accept requests until MongoDB enforces one open cart per user.
        await Cart.createIndexes();
        await Order.createIndexes();
        await RevokedSession.createIndexes();
        return {
          users: User,
          products: Product,
          carts: Cart,
          orders: Order,
          revokedSessions: RevokedSession,
        };
      },
    },
  ],
  exports: [MODELS],
})
export class DatabaseModule {}

export interface DatabaseModels {
  users: typeof User;
  products: typeof Product;
  carts: typeof Cart;
  orders: typeof Order;
  revokedSessions: typeof RevokedSession;
}
