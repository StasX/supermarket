import mongoose from 'mongoose';
import type { OrderSnapshot } from '../types/contracts';
import { orderSnapshotFields } from './order-snapshot.schema';

const orderSchema = new mongoose.Schema<OrderSnapshot>(orderSnapshotFields, { strict: 'throw' });

orderSchema.index(
  { cart_id: 1 },
  {
    unique: true,
    partialFilterExpression: { 'payment.mode': 'demo' },
    name: 'one_demo_order_per_cart',
  },
);

export = mongoose.model('orders', orderSchema);
