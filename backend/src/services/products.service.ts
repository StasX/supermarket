import {
  CartItem,
  CatalogInput,
  CategoryInput,
  SearchInput,
  ProductInput,
} from '../types/contracts';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { MODELS, DatabaseModels } from '../modules/database.module';
import { validateCartItems } from '../validators/cart.validator';
import { isObjectId } from '../validators/object-id';
import { productSearchFields } from '../utils/product-search';
import {
  isProductCategory,
  validateProduct,
  validateProductSearch,
} from '../validators/product.validator';
import { ImageStorageService } from './image-storage.service';

import {
  ProductImageCleanupService,
  uploadedFilenamePattern,
  uploadedImagePrefix,
} from './product-image-cleanup.service';

interface ProductImageUpload {
  bytes: Buffer;
  extension: 'png' | 'jpg' | 'webp';
}

interface ProductRecord {
  _id: mongoose.Types.ObjectId;
  name: string;
  price: number;
  image?: string | null;
  category: string;
}

const catalogPageSize = 24;

function productResponse({ _id, name, price, image, category }: ProductRecord) {
  return { id: _id, name, price, image: image ?? '', category };
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @Inject(MODELS) private readonly models: DatabaseModels,
    private readonly images: ImageStorageService,
    private readonly imageCleanup: ProductImageCleanupService,
  ) {}

  async productImage(filename: string) {
    const image = uploadedImagePrefix + filename;
    if (
      !uploadedFilenamePattern.test(filename) ||
      !(await this.models.products.exists({ image }))
    ) {
      throw new NotFoundException();
    }
    const stream = await this.images.get(filename);
    // The response cannot handle stream errors until the ownership check finishes.
    stream.once('error', () => undefined);
    try {
      // The product may have been edited or deleted while storage opened the stream.
      if (!(await this.models.products.exists({ image }))) throw new NotFoundException();
      if (stream.errored) throw stream.errored;
      return stream;
    } catch (error) {
      stream.destroy();
      throw error;
    }
  }

  async products(query: CatalogInput) {
    return this.catalogPage({}, query.after);
  }

  async category(body: CategoryInput) {
    const category = body?.category;
    if (!isProductCategory(category)) {
      return { success: false };
    }
    return this.catalogPage({ category }, body.after);
  }

  async find(body: SearchInput) {
    const name = validateProductSearch(body);
    if (!name) {
      return { success: false };
    }
    const normalized = name.toLowerCase();
    const gram = Array.from(normalized).slice(0, 3).join('');
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.catalogPage({ searchGrams: gram, searchName: new RegExp(escaped) }, body.after);
  }

  private async catalogPage(filter: Record<string, unknown>, after: unknown) {
    if (after !== undefined && !isObjectId(after)) return { success: false };
    const hint = filter['searchGrams'] ? { searchGrams: 1, _id: 1 } : undefined;
    const rows = await this.models.products.find(
      { ...filter, ...(after === undefined ? {} : { _id: { $gt: after } }) },
      { name: 1, category: 1, price: 1, image: 1 },
      { sort: { _id: 1 }, limit: catalogPageSize + 1, ...(hint ? { hint } : {}) },
    );
    const products = rows.slice(0, catalogPageSize).map(productResponse);
    const nextCursor = rows.length > catalogPageSize ? String(products.at(-1)!.id) : null;
    return { success: true, products, nextCursor };
  }

  async saveProduct(body: ProductInput, edit = false, upload?: ProductImageUpload) {
    const input = validateProduct(body, edit);
    if (!input) return { success: false };

    const { id, name, category, price, image } = input;
    const retainUpload = !upload && image?.startsWith(uploadedImagePrefix);
    // A managed image can only stay on its existing product. Its key is never reused.
    if (retainUpload && !id) return { success: false };

    const filename = upload ? `${randomUUID()}.${upload.extension}` : undefined;
    if (upload && filename) {
      try {
        const contentType = upload.extension === 'jpg' ? 'image/jpeg' : `image/${upload.extension}`;
        await this.images.put(filename, upload.bytes, contentType);
      } catch (error) {
        await this.imageCleanup.remove(uploadedImagePrefix + filename);
        throw error;
      }
    }

    const nextImage = filename ? uploadedImagePrefix + filename : image;
    const product = {
      name,
      ...productSearchFields(name),
      category,
      price,
      ...(nextImage !== undefined ? { image: nextImage } : {}),
    };
    try {
      if (id) {
        const previous = retainUpload
          ? await this.models.products.findOneAndUpdate(
              { _id: id, image },
              { $set: product },
              { returnDocument: 'before', runValidators: true },
            )
          : await this.models.products.findByIdAndUpdate(
              id,
              { $set: product },
              { returnDocument: 'before', runValidators: true },
            );
        if (!previous && filename) await this.imageCleanup.remove(product.image);
        if (previous && product.image !== undefined && previous.image !== product.image) {
          await this.imageCleanup.remove(previous.image);
        }
        return { success: Boolean(previous) };
      }
      await this.models.products.create(product);
      return { success: true };
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
        if (filename) await this.imageCleanup.remove(product.image);
        return { success: false };
      }
      if (filename) {
        if (error instanceof mongoose.Error.ValidationError) {
          await this.imageCleanup.remove(product.image);
        } else {
          // A lost database acknowledgement may still have committed the image reference.
          this.logger.warn(`Could not confirm the product save for image ${filename}`);
        }
      }
      throw error;
    }
  }

  async deleteProduct(body: Pick<ProductInput, 'id'>) {
    if (!isObjectId(body?.id)) return { success: false };
    const deleted = await this.models.products.findByIdAndDelete(body.id);
    if (deleted) await this.imageCleanup.remove(deleted.image);
    return { success: Boolean(deleted) };
  }

  async count() {
    return { success: true, count: await this.models.products.countDocuments({}) };
  }

  async productNames(ids: string[]) {
    const validIds = [...new Set(ids.filter(isObjectId))];
    if (!validIds.length) return new Map<string, string>();
    const rows = await this.models.products.find({ _id: { $in: validIds } }, { name: 1 });
    return new Map(rows.map((row) => [String(row._id), row.name]));
  }

  async resolveCartProducts(input: unknown, includeNames = false) {
    const items = validateCartItems(input);
    if (!items) return null;
    if (!items.length) return [];

    const catalog: ProductRecord[] = await this.models.products.find({
      _id: { $in: items.map(({ id }) => id) },
    });
    const productsById = new Map(catalog.map((product) => [String(product._id), product]));
    const products: CartItem[] = [];
    for (const { id, count } of items) {
      const product = productsById.get(id);
      const price = product?.price;
      if (
        typeof price !== 'number' ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isFinite(price * count)
      ) {
        return null;
      }
      products.push({
        id,
        count,
        price,
        ...(includeNames ? { name: product?.name || 'Unavailable product' } : {}),
      });
    }
    return products;
  }
}
