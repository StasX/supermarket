import { CartItem, CheckoutInput, record } from '../types/contracts';
import { isObjectId } from './object-id';

const shopDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function validateCheckout(body?: CheckoutInput) {
  const fail = (reason: string) => ({ success: false as const, reason });
  if (!isObjectId(body?.cartId)) return fail('Choose an open cart.');

  const { city, street, date: shippingDate } = record(body.shipping);
  if (!isAddressField(city) || !isAddressField(street)) {
    return fail('Enter a city and street (up to 150 characters each).');
  }
  const date = validateShippingDate(shippingDate);
  if (!date) return fail('Choose today or a future shipping date.');
  const payment = record(body.payment);
  const { method, last4 } = payment;
  // Demo payments accept only last-four metadata.
  if (
    method !== 'credit_card' ||
    typeof last4 !== 'string' ||
    !/^[0-9]{4}$/.test(last4) ||
    Object.keys(payment).some((key) => key !== 'method' && key !== 'last4')
  ) {
    return fail('Use the demo credit card. No charge will be made.');
  }
  return {
    success: true as const,
    cartId: body.cartId.toLowerCase(),
    shipping: { city: city.trim(), street: street.trim(), date },
    payment: { mode: 'demo', method, last4 },
    reviewedItems: body.reviewedItems,
  };
}

function isAddressField(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const length = value.trim().length;
  return length > 0 && length <= 150;
}

function validateShippingDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= shopDate.format(new Date())
    ? date
    : null;
}

export function matchesReviewedItems(reviewed: unknown, products: CartItem[]): boolean {
  if (!Array.isArray(reviewed) || reviewed.length !== products.length) return false;

  const byId = new Map<unknown, Record<string, unknown>>();
  for (const value of reviewed as unknown[]) {
    const item = record(value);
    byId.set(item['id'], item);
  }

  return products.every(({ id, count, price }) => {
    const item = byId.get(id);
    return item?.['count'] === count && item['unitPriceCents'] === Math.round(price * 100);
  });
}
