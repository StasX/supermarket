import {
  CategoryInput,
  SearchInput,
  ProductInput,
  CartInput,
  CheckoutInput,
  UserRecord,
  record,
} from './contracts';
import { Inject, Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { MODELS, DatabaseModels } from './database.module';
import { InvoiceService } from './invoice.service';

const categories = ['Milk & Eggs', 'Vegetables & Fruits', 'Meet & Fish', 'Wine & Drinks'];
const isValidProductOrCartId = (id: unknown): id is string =>
  typeof id === 'string' && mongoose.isObjectIdOrHexString(id);

interface ProductRecord {
  _id: mongoose.Types.ObjectId;
  name: string;
  price: number;
  image: string;
  category: string;
}

@Injectable()
export class ShopService {
  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly invoices: InvoiceService,
  ) {}

  async products() {
    const products: ProductRecord[] = await this.models.products.find({});
    return {
      success: true,
      products: products.map((product) => ({
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
      })),
    };
  }

  async category(body: CategoryInput) {
    if (typeof body.category !== 'string' || !categories.includes(body.category)) {
      return { success: false };
    }
    return {
      success: true,
      products: await this.models.products.find({ category: body.category }),
    };
  }

  async find(body: SearchInput) {
    const name = body.product ?? body.name;
    if (typeof name !== 'string' || !name.length) {
      return { success: false };
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
      success: true,
      products: await this.models.products.find({ name: new RegExp(escaped, 'i') }),
    };
  }

  async saveProduct(body: ProductInput, edit = false) {
    if (
      typeof body.name !== 'string' ||
      !body.name.length ||
      typeof body.category !== 'string' ||
      !categories.includes(body.category) ||
      !/^\d+\.\d{2}$/.test(String(body.price)) ||
      (edit && !isValidProductOrCartId(body.id))
    ) {
      return { success: false };
    }
    const product = {
      name: body.name,
      category: body.category,
      price: Number(body.price),
      ...(typeof body.image === 'string' ? { image: body.image } : {}),
    };
    if (edit) {
      const updated = await this.models.products.findByIdAndUpdate(body.id, { $set: product });
      return { success: Boolean(updated) };
    }
    if (await this.models.products.findOne({ name: body.name })) {
      return { success: false };
    }
    await this.models.products.create(product);
    return { success: true };
  }

  async count(collection: 'orders' | 'products', field: 'ordersCount' | 'productsCount') {
    const count =
      collection === 'orders'
        ? await this.models.orders.countDocuments({})
        : await this.models.products.countDocuments({});
    return { success: true, [field]: count };
  }

  async createCart(user: Pick<UserRecord, 'id' | 'username'>, body: CartInput) {
    const products = await this.cartProducts(body?.products);
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
    const products = await this.cartProducts(body.products);
    if (!products) {
      return { success: false };
    }
    const cart = await this.models.carts.findOneAndUpdate(
      { _id: body.id, user_id: user.id, status: 1 },
      { $set: { products } },
    );
    return cart ? { success: true, products } : { success: false };
  }

  private async cartProducts(input: unknown, includeNames = false) {
    if (!Array.isArray(input)) {
      return null;
    }
    const ids = new Set<string>();
    for (const value of input as unknown[]) {
      const item = record(value);
      if (
        !item ||
        !isValidProductOrCartId(item['id']) ||
        typeof item['count'] !== 'number' ||
        !Number.isSafeInteger(item['count']) ||
        item['count'] < 1
      ) {
        return null;
      }
      const id = item['id'].toLowerCase();
      if (ids.has(id)) {
        return null;
      }
      ids.add(id);
    }
    if (!input.length) {
      return [];
    }
    const catalog: ProductRecord[] = await this.models.products.find({ _id: { $in: [...ids] } });
    const productsById = new Map(catalog.map((product) => [String(product._id), product]));
    const products: { id: string; count: number; price: number; name?: string }[] = [];
    for (const value of input as unknown[]) {
      const item = record(value);
      if (!isValidProductOrCartId(item['id']) || typeof item['count'] !== 'number') return null;
      const id = item['id'].toLowerCase();
      const product = productsById.get(id);
      const price = product?.price;
      if (
        typeof price !== 'number' ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isFinite(price * item['count'])
      ) {
        return null;
      }
      products.push({
        id,
        count: item['count'],
        price,
        ...(includeNames ? { name: product?.name || 'Unavailable product' } : {}),
      });
    }
    return products;
  }

  async cart(user: Pick<UserRecord, 'id' | 'username'>) {
    const cart = await this.models.carts.findOne({ user_id: user.id, status: 1 });
    return cart
      ? { success: true, cart: { id: cart._id, products: cart.products, created: cart.created_at } }
      : { success: true };
  }

  async lastOrder(user: Pick<UserRecord, 'id' | 'username'>) {
    const order = await this.models.orders.findOne({ user_id: user.id }).sort({ _id: -1 });
    return order ? { success: true, order } : { success: true };
  }

  async checkout(user: Pick<UserRecord, 'id' | 'username'>, body: CheckoutInput) {
    const fail = (reason: string) => ({ success: false, reason });
    if (!isValidProductOrCartId(body?.cartId)) {
      return fail('Choose an open cart.');
    }
    const cartId = body.cartId.toLowerCase();
    const shipping = record(body.shipping);
    const payment = record(body.payment);
    if (
      !shipping ||
      ![shipping['city'], shipping['street']].every(
        (value) =>
          typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 150,
      )
    ) {
      return fail('Enter a city and street (up to 150 characters each).');
    }
    if (typeof shipping['city'] !== 'string' || typeof shipping['street'] !== 'string')
      return fail('Enter a city and street.');
    const date =
      typeof shipping['date'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(shipping['date'])
        ? new Date(`${shipping['date']}T00:00:00Z`)
        : new Date(NaN);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (
      typeof shipping['date'] !== 'string' ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== shipping['date'] ||
      shipping['date'] < today
    ) {
      return fail('Choose today or a future shipping date.');
    }
    // Demo payments accept only last-four metadata, never card numbers or CVC.
    if (
      payment['method'] !== 'credit_card' ||
      typeof payment['last4'] !== 'string' ||
      !/^[0-9]{4}$/.test(payment['last4']) ||
      Object.keys(payment).some((key) => !['method', 'last4'].includes(key))
    ) {
      return fail('Use the demo credit card. No charge will be made.');
    }
    let cart = await this.models.carts.findOne({ _id: cartId, user_id: user.id });
    if (!cart) {
      return fail('Cart not found.');
    }
    if (cart.status === 1) {
      const products = await this.cartProducts(cart.products, true);
      if (!products?.length) {
        return fail('Add available products before checking out.');
      }
      const totalCents = products.reduce(
        (sum, item) => sum + Math.round(item.price * 100) * item['count'],
        0,
      );
      if (!Number.isSafeInteger(totalCents)) {
        return fail('The order total is too large.');
      }
      const snapshot = {
        user_id: user.id,
        username: user.username,
        cart_id: String(cart._id),
        products,
        price: totalCents / 100,
        shipping: { city: shipping['city'].trim(), street: shipping['street'].trim(), date },
        payment: { mode: 'demo', method: 'credit_card', last4: payment['last4'] },
        created_at: new Date(),
      };
      // Persist the order snapshot and close the cart atomically. Matching products
      // prevents checkout racing with a cart edit. The snapshot supports safe retries.
      const closed = await this.models.carts.findOneAndUpdate(
        { _id: cart._id, user_id: user.id, status: 1, products: cart.products },
        { $set: { status: 0, checkout: snapshot } },
        { returnDocument: 'after' },
      );
      cart = closed || (await this.models.carts.findOne({ _id: cartId, user_id: user.id }));
    }
    if (cart?.status !== 0 || !cart.checkout) {
      return fail('Your cart changed. Review it and try again.');
    }
    const query = { cart_id: cartId, 'payment.mode': 'demo' };
    let order;
    try {
      order = await this.models.orders.findOneAndUpdate(
        query,
        { $setOnInsert: cart.checkout },
        { upsert: true, returnDocument: 'after' },
      );
    } catch (error) {
      if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) {
        throw error;
      }
      order = await this.models.orders.findOne(query);
    }
    if (!order) throw new Error('Unable to recover the checkout order.');
    const invoiceUrl = await this.invoices.ensure(order);
    return {
      success: true,
      order: {
        id: order._id,
        total: order.price,
        products: order.products,
        shipping: order.shipping,
        payment: order.payment,
        invoiceUrl,
      },
    };
  }
}
