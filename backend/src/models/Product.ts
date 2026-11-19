import mongoose from 'mongoose';
import { productCategories } from '../config/product-categories';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    category: { type: String, required: true, enum: productCategories },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isFinite,
    },
    image: { type: String, unique: true },
  },
  { strict: 'throw' },
);

export = mongoose.model('products', productSchema);
