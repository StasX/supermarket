import { CartInput, CartRecord, UserRecord } from '../types/contracts';
import { Inject, Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { MODELS, DatabaseModels } from '../modules/database.module';
import { ProductsService } from './products.service';
import { isObjectId } from '../validators/object-id';

function cartResponse(cart: Pick<CartRecord, 'products' | 'created_at'> & { _id: unknown }) {
  return { id: cart._id, products: cart.products, createdAt: cart.created_at };
}

@Injectable()
export class CartsService {
  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly products: ProductsService,
  ) {}

  async createCart(user: Pick<UserRecord, 'id' | 'username'>, body: CartInput) {
    const products = await this.products.resolveCartProducts(body?.products, true);
    if (!products) {
      return { success: false };
    }
    if (await this.models.carts.findOne({ user_id: user.id, status: 1 })) {
      return { success: false };
    }
    try {
      const cart = await this.models.carts.create({
        user_id: user.id,
        products: products.map(({ id, count, price }) => ({ id, count, price })),
        created_at: new Date(),
      });
      return { success: true, cart: { ...cartResponse(cart), products } };
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
        return { success: false };
      }
      throw error;
    }
  }

  async updateCart(user: Pick<UserRecord, 'id' | 'username'>, body: CartInput) {
    if (!isObjectId(body?.id)) {
      return { success: false };
    }
    const products = await this.products.resolveCartProducts(body.products, true);
    if (!products) {
      return { success: false };
    }
    const cart = await this.models.carts.findOneAndUpdate(
      { _id: body.id, user_id: user.id, status: 1 },
      { $set: { products: products.map(({ id, count, price }) => ({ id, count, price })) } },
      { returnDocument: 'after', runValidators: true },
    );
    return cart ? { success: true, cart: { ...cartResponse(cart), products } } : { success: false };
  }

  async cart(user: Pick<UserRecord, 'id' | 'username'>) {
    const cart = await this.models.carts.findOne({ user_id: user.id, status: 1 });
    if (!cart) return { success: true, cart: null };
    const names = await this.products.productNames(cart.products.map(({ id }) => id));
    const products = cart.products.map(({ id, count, price }) => ({
      id,
      count,
      price,
      name: names.get(id),
    }));
    return { success: true, cart: { ...cartResponse(cart), products } };
  }
}
