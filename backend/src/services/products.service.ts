import { CategoryInput, SearchInput, ProductInput, record } from '../types/contracts';
import { Inject, Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { MODELS, DatabaseModels } from '../modules/database.module';
import { productCategories } from '../config/product-categories';

const isValidProductOrCartId = (id: unknown): id is string =>
  typeof id === 'string' && mongoose.isObjectIdOrHexString(id);

function isValidPrice(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const text = String(value);
  const decimal = text.length - 3;
  if (decimal < 1 || text[decimal] !== '.') return false;
  for (let index = 0; index < text.length; index++) {
    if (index === decimal) continue;
    const digit = text.charCodeAt(index);
    if (digit < 48 || digit > 57) return false;
  }
  // Prices must remain representable as safe integer cents at checkout.
  return Number.isSafeInteger(Math.round(Number(text) * 100));
}

interface ProductRecord {
  _id: mongoose.Types.ObjectId;
  name: string;
  price: number;
  image: string;
  category: string;
}

@Injectable()
export class ProductsService {
  constructor(@Inject(MODELS) private readonly models: DatabaseModels) {}

  async products() {
    const products: ProductRecord[] = await this.models.products.find({});
    return {
      success: true,
      products: products.map((product) => ({
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
      })),
    };
  }

  async category(body: CategoryInput) {
    if (typeof body.category !== 'string' || !productCategories.includes(body.category)) {
      return { success: false };
    }
    return {
      success: true,
      products: await this.models.products.find({ category: body.category }),
    };
  }

  async find(body: SearchInput) {
    const name = body.product ?? body.name;
    if (typeof name !== 'string' || !name.length) {
      return { success: false };
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
      success: true,
      products: await this.models.products.find({ name: new RegExp(escaped, 'i') }),
    };
  }

  async saveProduct(body: ProductInput, edit = false) {
    if (
      typeof body.name !== 'string' ||
      !body.name.length ||
      typeof body.category !== 'string' ||
      !productCategories.includes(body.category) ||
      !isValidPrice(body.price) ||
      (edit && !isValidProductOrCartId(body.id))
    ) {
      return { success: false };
    }
    const product = {
      name: body.name,
      category: body.category,
      price: Number(body.price),
      ...(typeof body.image === 'string' ? { image: body.image } : {}),
    };
    try {
      if (edit) {
        const updated = await this.models.products.findByIdAndUpdate(
          body.id,
          { $set: product },
          { runValidators: true },
        );
        return { success: Boolean(updated) };
      }
      await this.models.products.create(product);
      return { success: true };
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
        return { success: false };
      }
      throw error;
    }
  }

  async deleteProduct(body: Pick<ProductInput, 'id'>) {
    if (!isValidProductOrCartId(body?.id)) return { success: false };
    const deleted = await this.models.products.findByIdAndDelete(body.id);
    return { success: Boolean(deleted) };
  }

  async count() {
    return { success: true, productsCount: await this.models.products.countDocuments({}) };
  }

  async resolveCartProducts(input: unknown, includeNames = false) {
    if (!Array.isArray(input)) {
      return null;
    }
    const ids = new Set<string>();
    for (const value of input as unknown[]) {
      const item = record(value);
      if (
        !item ||
        !isValidProductOrCartId(item['id']) ||
        typeof item['count'] !== 'number' ||
        !Number.isSafeInteger(item['count']) ||
        item['count'] < 1
      ) {
        return null;
      }
      const id = item['id'].toLowerCase();
      if (ids.has(id)) {
        return null;
      }
      ids.add(id);
    }
    if (!input.length) {
      return [];
    }
    const catalog: ProductRecord[] = await this.models.products.find({ _id: { $in: [...ids] } });
    const productsById = new Map(catalog.map((product) => [String(product._id), product]));
    const products: { id: string; count: number; price: number; name?: string }[] = [];
    for (const value of input as unknown[]) {
      const item = record(value);
      if (!isValidProductOrCartId(item['id']) || typeof item['count'] !== 'number') return null;
      const id = item['id'].toLowerCase();
      const product = productsById.get(id);
      const price = product?.price;
      if (
        typeof price !== 'number' ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isFinite(price * item['count'])
      ) {
        return null;
      }
      products.push({
        id,
        count: item['count'],
        price,
        ...(includeNames ? { name: product?.name || 'Unavailable product' } : {}),
      });
    }
    return products;
  }
}
