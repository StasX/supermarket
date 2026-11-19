import mongoose from 'mongoose';
import type { OrderSnapshot } from '../types/contracts';
import { cartItemSchema, hasUniqueProductIds, objectIdPattern } from './cart-item.schema';

export const orderSnapshotFields = {
  user_id: {
    type: Number,
    required: true,
    validate: Number.isSafeInteger,
  },
  username: { type: String, required: true },
  cart_id: { type: String, required: true, match: objectIdPattern },
  price: {
    type: Number,
    required: true,
    min: 0,
    validate: Number.isFinite,
  },
  shipping: {
    city: { type: String, required: true, trim: true, maxlength: 150 },
    street: { type: String, required: true, trim: true, maxlength: 150 },
    date: { type: Date, required: true },
  },
  created_at: { type: Date, required: true },
  products: {
    type: [cartItemSchema],
    required: true,
    default: undefined,
    validate: (items: OrderSnapshot['products']) => items.length > 0 && hasUniqueProductIds(items),
  },
  payment: {
    mode: { type: String, required: true, enum: ['demo'] },
    method: { type: String, required: true, enum: ['credit_card'] },
    last4: { type: String, required: true, match: /^[0-9]{4}$/ },
  },
};

export const orderSnapshotSchema = new mongoose.Schema<OrderSnapshot>(orderSnapshotFields, {
  _id: false,
  strict: 'throw',
});
