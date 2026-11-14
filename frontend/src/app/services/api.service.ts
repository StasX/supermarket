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
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  login(username: string, password: string) {
    return firstValueFrom(this.http.post<Result & Partial<User>>('/login', { username, password }));
  }

  async signup(body: Signup) {
    const send = () =>
      firstValueFrom(this.http.post<{ created: boolean; reason?: string }>('/sign-up', body));
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
      await firstValueFrom(this.http.get('/csrf-token'));
      return send();
    }
  }

  reconnect() {
    return firstValueFrom(
      this.http.get<
        Result & {
          role?: number;
          user?: string;
          isReturning?: boolean;
          name?: string | { first_name: string; last_name: string };
          address?: User['address'];
        }
      >('/reconect'),
    );
  }

  logout() {
    return firstValueFrom(this.http.post<Result>('/logout', {}));
  }

  async products(category = '', search = '') {
    const searchTerm = search.trim();
    let request;
    if (searchTerm) {
      request = this.http.post<ProductResult>('/find-product', { product: searchTerm });
    } else if (category) {
      request = this.http.post<ProductResult>('/get-products-by-category', { category });
    } else {
      request = this.http.get<ProductResult>('/get-all-products');
    }
    const result = await firstValueFrom(request);
    if (!result.success) {
      throw new Error('Unable to load products. Please sign in again.');
    }
    return result.products.map((product) => ({
      ...product,
      id: product.id || product._id!,
      price: Number(product.price),
    }));
  }

  saveProduct(product: Omit<Product, 'id'> & { id?: string }) {
    return firstValueFrom(
      this.http.post<Result>(product.id ? '/edit-product' : '/add-product', {
        ...product,
        price: Number(product.price).toFixed(2),
      }),
    );
  }

  deleteProduct(id: string) {
    return firstValueFrom(this.http.post<Result>('/delete-product', { id }));
  }

  uploadProductImage(file: File) {
    const body = new FormData();
    body.append('image', file);
    return firstValueFrom(
      this.http.post<Result & { image?: string }>('/upload-product-image', body),
    );
  }

  cart() {
    return firstValueFrom(this.http.get<Result & { cart?: Cart }>('/get-cart'));
  }

  lastOrder() {
    return firstValueFrom(this.http.get<Result & { order?: OrderHistory }>('/get-last-order'));
  }

  checkout(body: CheckoutRequest) {
    return firstValueFrom(
      this.http.post<Result & { reason?: string; order?: CheckoutOrder }>('/checkout', body),
    );
  }

  createCart(products: CartItem[]) {
    return firstValueFrom(
      this.http.post<Result & { id?: string; date?: string; products?: CartItem[] }>(
        '/create-cart',
        { products },
      ),
    );
  }

  updateCart(id: string, products: CartItem[]) {
    return firstValueFrom(
      this.http.post<Result & { products?: CartItem[] }>('/update-cart', { id, products }),
    );
  }

  count(type: 'orders' | 'products') {
    return firstValueFrom(
      this.http.get<Result & { ordersCount?: number; productsCount?: number }>(`/total-${type}`),
    );
  }
}
