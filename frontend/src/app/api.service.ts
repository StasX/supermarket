import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface User { user: string; role: number; name: string; }
export interface Product { id: string; name: string; category: string; price: number; image: string; }
export interface CartItem { id: string; count: number; price: number; }
export interface Cart { id: string; products: CartItem[]; created: string; }
export interface Result { success: boolean; }
export interface ProductResult extends Result { products: (Product & { _id?: string })[]; }
export interface Signup { id: string; email: string; pass: string; firstName: string; lastName: string; city: string; street: string; }
export const categories = ['Milk & Eggs', 'Vegetables & Fruits', 'Meet & Fish', 'Wine & Drinks'];

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  login(username: string, password: string) { return firstValueFrom(this.http.post<Result & Partial<User>>('/login', { username, password })); }
  signup(body: Signup) { return firstValueFrom(this.http.post<{ created: boolean; reason?: string }>('/sign-up', body)); }
  reconnect() { return firstValueFrom(this.http.get<Result & { role?: number; user?: string; name?: string | { first_name: string; last_name: string } }>('/reconect')); }
  logout() { return firstValueFrom(this.http.get<Result>('/logout')); }
  async products(category = '', search = '') {
    const result = await firstValueFrom(search.trim()
      ? this.http.post<ProductResult>('/find-product', { product: search.trim() })
      : category ? this.http.post<ProductResult>('/get-products-by-category', { category })
      : this.http.get<ProductResult>('/get-all-products'));
    if (!result.success) throw new Error('Unable to load products. Please sign in again.');
    return result.products.map(product => ({ ...product, id: product.id || product._id!, price: Number(product.price) }));
  }
  saveProduct(product: Omit<Product, 'id'> & { id?: string }) {
    return firstValueFrom(this.http.post<Result>(product.id ? '/edit-product' : '/add-product', { ...product, price: Number(product.price).toFixed(2) }));
  }
  uploadProductImage(file: File) {
    const body = new FormData(); body.append('image', file);
    return firstValueFrom(this.http.post<Result & { image?: string }>('/upload-product-image', body));
  }
  cart() { return firstValueFrom(this.http.get<Result & { cart?: Cart }>('/get-cart')); }
  createCart(products: CartItem[]) { return firstValueFrom(this.http.post<Result & { id?: string; date?: string }>('/create-cart', { products })); }
  updateCart(id: string, products: CartItem[]) { return firstValueFrom(this.http.post<Result>('/update-cart', { id, products })); }
  count(type: 'orders' | 'products') { return firstValueFrom(this.http.get<Result & { ordersCount?: number; productsCount?: number }>(`/total-${type}`)); }
}
