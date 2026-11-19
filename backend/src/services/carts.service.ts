import { CartInput, UserRecord } from '../types/contracts';
import { Inject, Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { MODELS, DatabaseModels } from '../modules/database.module';
import { ProductsService } from './products.service';

const isValidProductOrCartId = (id: unknown): id is string =>
  typeof id === 'string' && mongoose.isObjectIdOrHexString(id);

@Injectable()
export class CartsService {
  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly products: ProductsService,
  ) {}

  async createCart(user: Pick<UserRecord, 'id' | 'username'>, body: CartInput) {
    const products = await this.products.resolveCartProducts(body?.products);
    if (!products) {
      return { success: false };
    }
    if (await this.models.carts.findOne({ user_id: user.id, status: 1 })) {
      return { success: false };
    }
    try {
      const cart = await this.models.carts.create({
        user_id: user.id,
        products,
        created_at: new Date(),
      });
      return { success: true, id: cart._id, date: cart.created_at, products };
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
        return { success: false };
      }
      throw error;
    }
  }

  async updateCart(user: Pick<UserRecord, 'id' | 'username'>, body: CartInput) {
    if (!isValidProductOrCartId(body?.id)) {
      return { success: false };
    }
    const products = await this.products.resolveCartProducts(body.products);
    if (!products) {
      return { success: false };
    }
    const cart = await this.models.carts.findOneAndUpdate(
      { _id: body.id, user_id: user.id, status: 1 },
      { $set: { products } },
      { runValidators: true },
    );
    return cart ? { success: true, products } : { success: false };
  }

  async cart(user: Pick<UserRecord, 'id' | 'username'>) {
    const cart = await this.models.carts.findOne({ user_id: user.id, status: 1 });
    return cart
      ? { success: true, cart: { id: cart._id, products: cart.products, created: cart.created_at } }
      : { success: true };
  }
}
