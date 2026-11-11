import { Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import mongoose from 'mongoose';

export const MODELS = 'MODELS';

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown() { await mongoose.disconnect(); }
}

@Module({
  providers: [DatabaseLifecycle, {
    provide: MODELS,
    useFactory: async () => {
      await mongoose.connect(process.env['MONGODB_URI'] || 'mongodb://localhost:27017/shop');
      return {
        users: require('./models/User'),
        products: require('./models/Product'),
        carts: require('./models/Cart'),
        orders: require('./models/Order'),
      };
    },
  }],
  exports: [MODELS],
})
export class DatabaseModule {}
