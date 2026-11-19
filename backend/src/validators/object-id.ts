import mongoose from 'mongoose';

export function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.isObjectIdOrHexString(value);
}
