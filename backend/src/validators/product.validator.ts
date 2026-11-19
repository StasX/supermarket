import { productCategories } from '../config/product-categories';
import type { ProductInput, SearchInput } from '../types/contracts';
import { isObjectId } from './object-id';

export function isProductCategory(value: unknown): value is string {
  return typeof value === 'string' && productCategories.includes(value);
}

export function validateProductSearch(body?: SearchInput) {
  const name = body?.product ?? body?.name;
  return typeof name === 'string' && name.length ? name : null;
}

export function validateProduct(body: ProductInput | undefined, edit: boolean) {
  const { id, name, category, price, image } = body ?? {};
  const productId = edit && isObjectId(id) ? id : undefined;
  if (
    typeof name !== 'string' ||
    !name.length ||
    !isProductCategory(category) ||
    !isValidPrice(price) ||
    (edit && !productId)
  ) {
    return null;
  }
  return {
    id: productId,
    name,
    category,
    price: Number(price),
    image: typeof image === 'string' ? image : undefined,
  };
}

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

/** Identify supported image formats from their file signatures. */
export function productImageExtension(bytes: Buffer): 'png' | 'jpg' | 'webp' | null {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.subarray(0, 8).equals(pngSignature)) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';

  const isWebp =
    bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return isWebp ? 'webp' : null;
}
