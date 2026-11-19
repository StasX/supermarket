import mongoose from 'mongoose';
import type { OrderRecord } from '../types/contracts';
import { orderSnapshotFields } from './order-snapshot.schema';

const orderSchema = new mongoose.Schema<OrderRecord>(
  {
    ...orderSnapshotFields,
    invoiceKey: { type: String, match: /^invoices\/[a-f\d]{24}\.pdf$/i },
  },
  { strict: 'throw' },
);

orderSchema.index(
  { cart_id: 1 },
  {
    unique: true,
    partialFilterExpression: { 'payment.mode': 'demo' },
    name: 'one_demo_order_per_cart',
  },
);

export = mongoose.model('orders', orderSchema);
