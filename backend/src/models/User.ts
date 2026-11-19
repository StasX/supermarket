import mongoose from 'mongoose';
import type { UserRecord } from '../types/contracts';

const CUSTOMER = 0;
const ADMIN = 1;

const userSchema = new mongoose.Schema<UserRecord>(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      min: 0,
      max: 999999999,
      validate: Number.isSafeInteger,
    },
    name: {
      first_name: { type: String, required: true, maxlength: 150 },
      last_name: { type: String, required: true, maxlength: 150 },
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: { type: String, required: true },
    address: {
      city: { type: String, required: true, maxlength: 150 },
      street: { type: String, required: true, maxlength: 150 },
    },
    // Existing accounts are returning customers; signup marks new accounts explicitly.
    has_logged_in: { type: Boolean, required: true, default: true },
    role: {
      type: Number,
      required: true,
      enum: [CUSTOMER, ADMIN],
      default: CUSTOMER,
    },
  },
  { strict: 'throw' },
);

export = mongoose.model('users', userSchema);
