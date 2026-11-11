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
    if (!Array.isArray(body.products)) return { success: false };
    if (await this.models.carts.findOne({ user_id: user.id, status: 1 })) return { success: false };
    const cart = await this.models.carts.create({ user_id: user.id, products: body.products, created_at: new Date() });
    return { success: true, id: cart._id, date: cart.created_at };
  }

  async updateCart(user: any, body: any) {
    if (!validId(body.id) || !Array.isArray(body.products)) return { success: false };
    const cart = await this.models.carts.findOneAndUpdate(
      { _id: body.id, user_id: user.id, status: 1 }, { $set: { products: body.products } },
    );
    return { success: Boolean(cart) };
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
