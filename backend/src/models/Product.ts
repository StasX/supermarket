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
    searchName: String,
    searchGrams: { type: [String], default: undefined },
  },
  { strict: 'throw' },
);

productSchema.index({ category: 1, _id: 1 });
productSchema.index({ searchGrams: 1, _id: 1 });

export = mongoose.model('products', productSchema);
