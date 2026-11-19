import { CheckoutInput, OrderSnapshot, UserRecord } from '../types/contracts';
import { Inject, Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { MODELS, DatabaseModels } from '../modules/database.module';
import { ProductsService } from './products.service';
import { matchesReviewedItems, validateCheckout } from '../validators/checkout.validator';

function orderResponse(order: OrderSnapshot & { _id: unknown }) {
  return {
    id: order._id,
    total: order.price,
    createdAt: order.created_at,
    products: order.products,
    shipping: order.shipping
      ? { city: order.shipping.city, street: order.shipping.street, date: order.shipping.date }
      : undefined,
    ...(order.payment?.mode === 'demo'
      ? {
          payment: {
            mode: order.payment.mode,
            method: order.payment.method,
            last4: order.payment.last4,
          },
          invoiceUrl: `/orders/${order._id}/invoice`,
        }
      : {}),
  };
}

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly products: ProductsService,
  ) {}

  async count() {
    return { success: true, count: await this.models.orders.countDocuments({}) };
  }

  async lastOrder(user: Pick<UserRecord, 'id' | 'username'>) {
    const order = await this.models.orders.findOne({ user_id: user.id }).sort({ _id: -1 });
    return { success: true, order: order ? orderResponse(order) : null };
  }

  async checkout(user: Pick<UserRecord, 'id' | 'username'>, body: CheckoutInput) {
    const fail = (reason: string) => ({ success: false, reason });
    const input = validateCheckout(body);
    if (!input.success) return input;
    const { cartId, shipping, payment, reviewedItems } = input;
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
      if (!matchesReviewedItems(reviewedItems, products)) {
        return {
          ...fail('Your cart items or prices changed. Review the updated order before placing it.'),
          review: { products },
        };
      }
      const snapshot = {
        user_id: user.id,
        username: user.username,
        cart_id: String(cart._id),
        products,
        price: totalCents / 100,
        shipping,
        payment,
        created_at: new Date(),
      };
      // Persist the order snapshot and close the cart atomically. Matching products
      // prevents checkout racing with a cart edit. The snapshot supports safe retries.
      const closed = await this.models.carts.findOneAndUpdate(
        { _id: cart._id, user_id: user.id, status: 1, products: cart.products },
        { $set: { status: 0, checkout: snapshot } },
        { returnDocument: 'after', runValidators: true },
      );
      cart = closed || (await this.models.carts.findOne({ _id: cartId, user_id: user.id }));
    }
    if (cart?.status !== 0 || !cart.checkout) {
      return fail('Your cart changed. Review it and try again.');
    }
    if (!matchesReviewedItems(reviewedItems, cart.checkout.products)) {
      return fail('This cart was already checked out with different items or prices.');
    }
    const query = { cart_id: cartId, 'payment.mode': 'demo' };
    let order;
    try {
      order = await this.models.orders.findOneAndUpdate(
        query,
        { $setOnInsert: cart.toObject?.().checkout ?? cart.checkout },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
    } catch (error) {
      if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) {
        throw error;
      }
      order = await this.models.orders.findOne(query);
    }
    if (!order) throw new Error('Unable to recover the checkout order.');
    return { success: true, order: orderResponse(order) };
  }
}
