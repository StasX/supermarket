import { CheckoutInput, UserRecord, record } from '../types/contracts';
import { Inject, Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { MODELS, DatabaseModels } from '../modules/database.module';
import { ProductsService } from './products.service';
import { InvoiceService } from './invoice.service';

const isValidProductOrCartId = (id: unknown): id is string =>
  typeof id === 'string' && mongoose.isObjectIdOrHexString(id);

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly products: ProductsService,
    private readonly invoices: InvoiceService,
  ) {}

  async count() {
    return { success: true, ordersCount: await this.models.orders.countDocuments({}) };
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
      const products = await this.products.resolveCartProducts(cart.products, true);
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
