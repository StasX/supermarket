import { Inject, Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { MODELS } from './database.module';

const categories = ['Milk & Eggs', 'Vegetables & Fruits', 'Meet & Fish', 'Wine & Drinks'];
const validId = (id: unknown) => typeof id === 'string' && mongoose.isObjectIdOrHexString(id);

interface ProductRecord {
  _id: mongoose.Types.ObjectId;
  name: string;
  price: number;
  image: string;
  category: string;
}

@Injectable()
export class ShopService {
  constructor(@Inject(MODELS) private readonly models: any) {}

  async products() {
    const products: ProductRecord[] = await this.models.products.find({});
    return { success: true, products: products.map(product => ({
      id: product._id, name: product.name, price: product.price, image: product.image, category: product.category,
    })) };
  }

  async category(body: any) {
    if (!categories.includes(body.category)) return { success: false };
    return { success: true, products: await this.models.products.find({ category: body.category }) };
  }

  async find(body: any) {
    const name = body.product ?? body.name;
    if (typeof name !== 'string' || !name.length) return { success: false };
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { success: true, products: await this.models.products.find({ name: new RegExp(escaped, 'i') }) };
  }

  async saveProduct(body: any, edit = false) {
    if (typeof body.name !== 'string' || !body.name.length || !categories.includes(body.category) ||
      !/^\d+\.\d{2}$/.test(String(body.price)) || (edit && !validId(body.id))) return { success: false };
    const product = { name: body.name, category: body.category, price: body.price, image: body.image };
    if (edit) {
      const updated = await this.models.products.findByIdAndUpdate(body.id, { $set: product });
      return { success: Boolean(updated) };
    }
    if (await this.models.products.findOne({ name: body.name })) return { success: false };
    await this.models.products.create(product);
    return { success: true };
  }

  async count(collection: string, field: string) {
    return { success: true, [field]: await this.models[collection].countDocuments({}) };
  }

  async createCart(user: any, body: any) {
    const products = await this.cartProducts(body?.products);
    if (!products) return { success: false };
    if (await this.models.carts.findOne({ user_id: user.id, status: 1 })) return { success: false };
    try {
      const cart = await this.models.carts.create({ user_id: user.id, products, created_at: new Date() });
      return { success: true, id: cart._id, date: cart.created_at, products };
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) return { success: false };
      throw error;
    }
  }

  async updateCart(user: any, body: any) {
    if (!validId(body?.id)) return { success: false };
    const products = await this.cartProducts(body.products);
    if (!products) return { success: false };
    const cart = await this.models.carts.findOneAndUpdate(
      { _id: body.id, user_id: user.id, status: 1 }, { $set: { products } },
    );
    return cart ? { success: true, products } : { success: false };
  }

  private async cartProducts(input: unknown) {
    if (!Array.isArray(input)) return null;
    const ids = new Set<string>();
    for (const item of input) {
      if (!item || !validId(item.id) || !Number.isSafeInteger(item.count) || item.count < 1) return null;
      const id = item.id.toLowerCase();
      if (ids.has(id)) return null;
      ids.add(id);
    }
    if (!input.length) return [];
    const catalog: ProductRecord[] = await this.models.products.find({ _id: { $in: [...ids] } });
    const prices = new Map(catalog.map(product => [String(product._id), product.price]));
    const products: { id: string; count: number; price: number }[] = [];
    for (const item of input) {
      const id = item.id.toLowerCase();
      const price = prices.get(id);
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || !Number.isFinite(price * item.count)) return null;
      products.push({ id, count: item.count, price });
    }
    return products;
  }

  async cart(user: any) {
    const cart = await this.models.carts.findOne({ user_id: user.id, status: 1 });
    return cart ? { success: true, cart: { id: cart._id, products: cart.products, created: cart.created_at } } : { success: true };
  }

  async lastOrder(user: any) {
    const order = await this.models.orders.findOne({ user_id: user.id }).sort({ _id: -1 });
    return order ? { success: true, order } : { success: true };
  }
}
