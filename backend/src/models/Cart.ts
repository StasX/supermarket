import mongoose from 'mongoose';
import type { CartRecord } from '../types/contracts';
import { cartItemSchema, hasUniqueProductIds } from './cart-item.schema';
import { orderSnapshotSchema } from './order-snapshot.schema';

const CLOSED = 0;
const OPEN = 1;

const cartSchema = new mongoose.Schema<CartRecord>(
  {
    user_id: {
      type: Number,
      required: true,
      validate: Number.isSafeInteger,
    },
    products: {
      type: [cartItemSchema],
      required: true,
      default: undefined,
      validate: hasUniqueProductIds,
    },
    created_at: { type: Date, required: true },
    checkout: orderSnapshotSchema,
    status: {
      type: Number,
      required: true,
      enum: [CLOSED, OPEN],
      default: OPEN,
    },
  },
  { strict: 'throw' },
);

cartSchema.index(
  { user_id: 1 },
  {
    unique: true,
    partialFilterExpression: { status: OPEN },
    name: 'one_open_cart_per_user',
  },
);

export = mongoose.model('carts', cartSchema);
