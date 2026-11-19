import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    nextAttemptAt: { type: Date, required: true, index: true },
    attempts: { type: Number, required: true, default: 0 },
  },
  { strict: 'throw' },
);

export = mongoose.model('product_image_deletions', schema);
