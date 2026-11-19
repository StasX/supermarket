import mongoose from 'mongoose';
import User = require('../models/User');
import Product = require('../models/Product');
import Cart = require('../models/Cart');
import Order = require('../models/Order');
import RevokedSession = require('../models/RevokedSession');
import ProductImageDeletion = require('../models/ProductImageDeletion');
import { productSearchFields } from '../utils/product-search';

export const databaseModels = {
  users: User,
  products: Product,
  carts: Cart,
  orders: Order,
  revokedSessions: RevokedSession,
  productImageDeletions: ProductImageDeletion,
};

export type DatabaseModels = typeof databaseModels;

export function connectDatabase(
  uri = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/shop',
) {
  return mongoose.connect(uri, { autoIndex: false, autoCreate: false });
}

async function modelsWithMissingIndexes() {
  const models = Object.values(databaseModels);
  const diffs = await Promise.all(models.map((model) => model.diffIndexes()));
  return models.filter((_, index) => diffs[index].toCreate.length > 0);
}

export async function provisionDatabaseIndexes() {
  for (const model of await modelsWithMissingIndexes()) {
    await model.createIndexes();
  }
  const products = databaseModels.products.collection;
  for await (const product of products.find(
    { searchName: { $exists: false }, name: { $type: 'string' } },
    { projection: { name: 1 } },
  )) {
    await products.updateOne(
      { _id: product._id, name: product['name'], searchName: { $exists: false } },
      { $set: productSearchFields(product['name']) },
    );
  }
}

export async function verifyDatabaseIndexes() {
  const missing = await modelsWithMissingIndexes();
  if (missing.length) {
    const collections = missing.map((model) => model.collection.name).join(', ');
    throw new Error(
      `Missing or incompatible MongoDB indexes for ${collections}. Run npm run db:indexes before starting the app.`,
    );
  }
}
