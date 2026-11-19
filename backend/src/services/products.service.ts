import { CategoryInput, SearchInput, ProductInput, record } from '../types/contracts';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { MODELS, DatabaseModels } from '../modules/database.module';
import { productCategories } from '../config/product-categories';
import { ImageStorageService } from './image-storage.service';

const uploadedImagePrefix = '/products/uploads/';
const uploadedFilenamePattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:png|jpg|webp)$/;

interface ProductImageUpload {
  bytes: Buffer;
  extension: 'png' | 'jpg' | 'webp';
}

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
  image?: string | null;
  category: string;
}

function productResponse({ _id, name, price, image, category }: ProductRecord) {
  return { id: _id, name, price, image: image ?? '', category };
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly images: ImageStorageService,
  ) {}

  async productImage(filename: string) {
    if (
      !uploadedFilenamePattern.test(filename) ||
      !(await this.models.products.exists({ image: uploadedImagePrefix + filename }))
    ) {
      throw new NotFoundException();
    }
    return this.images.get(filename);
  }

  async products() {
    const products: ProductRecord[] = await this.models.products.find({});
    return {
      success: true,
      products: products.map(productResponse),
    };
  }

  async category(body: CategoryInput) {
    if (typeof body.category !== 'string' || !productCategories.includes(body.category)) {
      return { success: false };
    }
    return {
      success: true,
      products: (await this.models.products.find({ category: body.category })).map(productResponse),
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
      products: (await this.models.products.find({ name: new RegExp(escaped, 'i') })).map(
        productResponse,
      ),
    };
  }

  async saveProduct(body: ProductInput, edit = false, upload?: ProductImageUpload) {
    if (
      typeof body?.name !== 'string' ||
      !body.name.length ||
      typeof body.category !== 'string' ||
      !productCategories.includes(body.category) ||
      !isValidPrice(body.price) ||
      (edit && !isValidProductOrCartId(body.id))
    ) {
      return { success: false };
    }
    const image = typeof body.image === 'string' ? body.image : undefined;
    const retainUpload = !upload && image?.startsWith(uploadedImagePrefix);
    // A managed image can only stay on its existing product. Its key is never reused.
    if (retainUpload && !edit) return { success: false };

    const filename = upload ? `${randomUUID()}.${upload.extension}` : undefined;
    if (upload && filename) {
      try {
        const contentType = upload.extension === 'jpg' ? 'image/jpeg' : `image/${upload.extension}`;
        await this.images.put(filename, upload.bytes, contentType);
      } catch (error) {
        await this.removeUploadedImage(uploadedImagePrefix + filename);
        throw error;
      }
    }

    const nextImage = filename ? uploadedImagePrefix + filename : image;
    const product = {
      name: body.name,
      category: body.category,
      price: Number(body.price),
      ...(nextImage !== undefined ? { image: nextImage } : {}),
    };
    try {
      if (edit) {
        const previous = retainUpload
          ? await this.models.products.findOneAndUpdate(
              { _id: body.id, image },
              { $set: product },
              { returnDocument: 'before', runValidators: true },
            )
          : await this.models.products.findByIdAndUpdate(
              body.id,
              { $set: product },
              { returnDocument: 'before', runValidators: true },
            );
        if (!previous && filename) await this.removeUploadedImage(product.image);
        if (previous && product.image !== undefined && previous.image !== product.image) {
          await this.removeUploadedImage(previous.image);
        }
        return { success: Boolean(previous) };
      }
      await this.models.products.create(product);
      return { success: true };
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
        if (filename) await this.removeUploadedImage(product.image);
        return { success: false };
      }
      if (filename) {
        if (error instanceof mongoose.Error.ValidationError) {
          await this.removeUploadedImage(product.image);
        } else {
          // A lost database acknowledgement may still have committed the image reference.
          this.logger.warn(`Could not confirm the product save for image ${filename}`);
        }
      }
      throw error;
    }
  }

  async deleteProduct(body: Pick<ProductInput, 'id'>) {
    if (!isValidProductOrCartId(body?.id)) return { success: false };
    const deleted = await this.models.products.findByIdAndDelete(body.id);
    if (deleted) await this.removeUploadedImage(deleted.image);
    return { success: Boolean(deleted) };
  }

  private async removeUploadedImage(image?: string | null) {
    if (!image?.startsWith(uploadedImagePrefix)) return;
    const filename = image.slice(uploadedImagePrefix.length);
    if (!uploadedFilenamePattern.test(filename)) return;
    try {
      await this.images.deleteProductImage(filename);
    } catch {
      this.logger.error(`Could not delete unused product image ${filename}`);
    }
  }

  async count() {
    return { success: true, count: await this.models.products.countDocuments({}) };
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
