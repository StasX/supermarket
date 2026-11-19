import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  User,
  Product,
  CartItem,
  Cart,
  OrderHistory,
  Result,
  CheckoutRequest,
  CheckoutOrder,
  ProductResult,
  Signup,
  SignupAvailability,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  login(username: string, password: string) {
    return firstValueFrom(
      this.http.post<Result & Partial<User>>('/api/auth/login', { username, password }),
    );
  }

  checkSignup(body: Pick<Signup, 'email' | 'id'>) {
    return this.signupRequest<SignupAvailability>('/api/auth/signup/availability', body);
  }

  signup(body: Signup) {
    return this.signupRequest<Result & { reason?: string }>('/api/auth/signup', body);
  }

  private async signupRequest<T>(url: string, body: unknown): Promise<T> {
    const send = () => firstValueFrom(this.http.post<T>(url, body));
    try {
      return await send();
    } catch (error) {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 403 ||
        error.error?.reason !== 'Invalid CSRF token or request origin.'
      ) {
        throw error;
      }
      // A stale token can remain in an open tab after the session or signing key changes.
      // The guard rejects the original request before signup performs any writes.
      await firstValueFrom(this.http.get('/api/auth/csrf-token'));
      return send();
    }
  }

  reconnect() {
    return firstValueFrom(this.http.get<Result & Partial<User>>('/api/auth/session'));
  }

  logout() {
    return firstValueFrom(this.http.post<Result>('/api/auth/logout', {}));
  }

  async products(category = '', search = '') {
    const searchTerm = search.trim();
    let request;
    if (searchTerm) {
      request = this.http.post<ProductResult>('/api/products/search', { product: searchTerm });
    } else if (category) {
      request = this.http.post<ProductResult>('/api/products/by-category', { category });
    } else {
      request = this.http.get<ProductResult>('/api/products');
    }
    const result = await firstValueFrom(request);
    if (!result.success) {
      throw new Error('Unable to load products. Please sign in again.');
    }
    return result.products;
  }

  saveProduct(product: Omit<Product, 'id'> & { id?: string }, file?: File | null) {
    const url = product.id ? '/api/products/update' : '/api/products/create';
    const { id, name, category, image } = product;
    const price = Number(product.price).toFixed(2);
    if (!file) {
      return firstValueFrom(this.http.post<Result>(url, { id, name, category, image, price }));
    }
    const body = new FormData();
    if (id) body.append('id', id);
    body.append('name', name);
    body.append('category', category);
    body.append('price', price);
    body.append('image', file);
    return firstValueFrom(this.http.post<Result>(url, body));
  }

  deleteProduct(id: string) {
    return firstValueFrom(this.http.post<Result>('/api/products/delete', { id }));
  }

  cart() {
    return firstValueFrom(this.http.get<Result & { cart: Cart | null }>('/api/carts/current'));
  }

  lastOrder() {
    return firstValueFrom(
      this.http.get<Result & { order: OrderHistory | null }>('/api/orders/latest'),
    );
  }

  checkout(body: CheckoutRequest) {
    return firstValueFrom(
      this.http.post<Result & { reason?: string; order?: CheckoutOrder }>(
        '/api/orders/checkout',
        body,
      ),
    );
  }

  createCart(products: CartItem[]) {
    return firstValueFrom(this.http.post<Result & { cart?: Cart }>('/api/carts', { products }));
  }

  updateCart(id: string, products: CartItem[]) {
    return firstValueFrom(
      this.http.post<Result & { cart?: Cart }>('/api/carts/update', { id, products }),
    );
  }

  count(type: 'orders' | 'products') {
    return firstValueFrom(this.http.get<Result & { count: number }>(`/api/${type}/count`));
  }
}
