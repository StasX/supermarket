import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService, CartItem, Product } from './api.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(ApiService);
  readonly id = signal<string | null>(null); readonly items = signal<CartItem[]>([]);
  readonly catalog = signal<Product[]>([]); readonly busy = signal(false); readonly created = signal('');
  readonly total = computed(() => this.items().reduce((sum, item) => sum + item.price * item.count, 0));
  readonly lines = computed(() => this.items().map(item => ({ ...item, name: this.catalog().find(product => product.id === item.id)?.name ?? 'Unavailable product' })));
  async load() {
    this.busy.set(true);
    try {
      const [result, products] = await Promise.all([this.api.cart(), this.api.products()]);
      if (!result.success) throw new Error('Unable to load your cart. Please sign in again.');
      this.catalog.set(products); this.id.set(result.cart?.id ?? null);
      this.items.set(result.cart?.products ?? []); this.created.set(result.cart?.created ?? '');
    } finally { this.busy.set(false); }
  }
  async add(product: Product) {
    const existing = this.items().find(item => item.id === product.id);
    await this.save(existing ? this.items().map(item => item.id === product.id ? { ...item, count: item.count + 1 } : item)
      : [...this.items(), { id: product.id, count: 1, price: product.price }]);
  }
  async quantity(id: string, count: number) {
    if (!Number.isInteger(count) || count < 1) throw new Error('Quantity must be a positive whole number.');
    await this.save(this.items().map(item => item.id === id ? { ...item, count } : item));
  }
  async remove(id: string) { await this.save(this.items().filter(item => item.id !== id)); }
  private async save(items: CartItem[]) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const id = this.id();
      if (id) {
        if (!(await this.api.updateCart(id, items)).success) throw new Error('Cart was not saved. Please try again.');
      } else {
        const result = await this.api.createCart(items);
        if (!result.success || !result.id) throw new Error('Cart was not saved. Please try again.');
        this.id.set(result.id); this.created.set(result.date ?? '');
      }
      this.items.set(items);
    } finally { this.busy.set(false); }
  }
  clear() { this.id.set(null); this.items.set([]); this.catalog.set([]); this.created.set(''); }
}
