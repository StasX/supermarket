import type { UserRecord } from '../contracts';
import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const User = new Schema<UserRecord>({
  id: {
    type: Number,
    unique: true,
  },
  name: {
    first_name: String,
    last_name: String,
  },
  username: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },

  password: {
    type: String,
    required: true,
  },
  address: {
    city: String,
    street: String,
  },
  // Existing accounts are returning customers; signup marks new accounts explicitly.
  has_logged_in: { type: Boolean, default: true },
  role: {
    type: Number,
    default: 0 /* 0: regular user, 1: administrator */,
  },
});
export = mongoose.model('users', User);
