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
}
export interface Cart {
  id: string;
  products: CartItem[];
  created: string;
}
export interface OrderHistory {
  _id: string;
  price?: number;
  created_at?: string;
  products?: (CartItem & { name?: string })[];
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
  shipping: { city: string; street: string; date: string };
  payment: { method: 'credit_card'; last4: string };
}
export interface CheckoutOrder {
  id: string;
  total: number;
  products?: CartItem[];
  invoiceUrl: string;
  shipping: { city: string; street: string; date: string };
  payment: { mode: 'demo'; method: string; last4: string };
}
export interface ProductResult extends Result {
  products: (Product & { _id?: string })[];
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
