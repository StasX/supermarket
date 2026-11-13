import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Types } from 'mongoose';
// Request fields are untrusted until validated by the services.
export type Input<K extends string> = Partial<Record<K, unknown>>;
export type LoginInput = Input<'username' | 'password'>;
export type SignupInput = Input<
  'id' | 'firstName' | 'lastName' | 'city' | 'street' | 'email' | 'pass'
>;
export type CategoryInput = Input<'category'>;
export type SearchInput = Input<'product' | 'name'>;
export type ProductInput = Input<'id' | 'name' | 'category' | 'price' | 'image'>;
export type CartInput = Input<'id' | 'products'>;
export type CheckoutInput = Input<'cartId' | 'shipping' | 'payment'>;
export function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export interface UserRecord {
  _id: Types.ObjectId;
  id: number;
  username: string;
  password: string;
  name: { first_name: string; last_name: string };
  address: { city: string; street: string };
  has_logged_in: boolean;
  role: number;
}
export type SessionUser = UserRecord & { isReturning: boolean };
export interface SessionRequest extends IncomingMessage {
  cookies?: { SESSIONID?: unknown };
  user_data: SessionUser;
}
export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax';
  path: string;
}
export interface CookieResponse extends ServerResponse {
  cookie(name: string, value: string, options: CookieOptions): void;
  clearCookie(name: string, options: CookieOptions): void;
}
export interface CartItem {
  id: string;
  count: number;
  price: number;
  name?: string;
}
export interface OrderRecord {
  user_id: number;
  username: string;
  cart_id: string;
  price: number;
  shipping: { city: string; street: string; date: Date };
  created_at: Date;
  products: CartItem[];
  invoiceKey?: string;
  payment: { mode: string; method: string; last4: string };
}
export interface CartRecord {
  user_id: number;
  products: CartItem[];
  created_at: Date;
  checkout?: OrderRecord;
  status: number;
}
