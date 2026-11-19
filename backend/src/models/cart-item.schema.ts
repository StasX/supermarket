import mongoose from 'mongoose';
import type { CartItem } from '../types/contracts';

export const objectIdPattern = /^[a-f\d]{24}$/i;

export const cartItemSchema = new mongoose.Schema<CartItem>(
  {
    id: { type: String, required: true, match: objectIdPattern },
    count: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isFinite,
    },
    name: String,
  },
  { _id: false, strict: 'throw' },
);

export function hasUniqueProductIds(items: (CartItem | null | undefined)[]): boolean {
  const ids = items.map((item) => item?.id?.toLowerCase());
  return !ids.includes(undefined) && new Set(ids).size === ids.length;
}
