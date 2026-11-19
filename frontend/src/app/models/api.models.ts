export interface User {
  user: string;
  role: number;
  name: string;
  isReturning?: boolean;
  address?: { city?: string; street?: string };
}
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
}
export interface CartItem {
  id: string;
  count: number;
  price: number;
  name?: string;
}
export interface Cart {
  id: string;
  products: CartItem[];
  createdAt: string;
}
export interface OrderHistory {
  id: string;
  total?: number;
  createdAt?: string;
  products?: CartItem[];
}
export interface Result {
  success: boolean;
}
export interface SignupAvailability extends Result {
  available: boolean;
  emailExists?: boolean;
  idExists?: boolean;
  reason?: string;
}
export interface CheckoutRequest {
  cartId: string;
  reviewedItems: { id: string; count: number; unitPriceCents: number }[];
  shipping: { city: string; street: string; date: string };
  payment: { method: 'credit_card'; last4: string };
}
export interface CheckoutOrder extends OrderHistory {
  total: number;
  invoiceUrl: string;
  shipping: { city: string; street: string; date: string };
  payment: { mode: 'demo'; method: string; last4: string };
}
export interface ProductResult extends Result {
  products: Product[];
  nextCursor: string | null;
}
export interface Signup {
  id: string;
  email: string;
  pass: string;
  firstName: string;
  lastName: string;
  city: string;
  street: string;
}
