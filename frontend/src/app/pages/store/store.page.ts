import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Product } from '../../models/api.models';
import { categories } from '../../constants/product-categories';
import { CartService } from '../../services/cart.service';
import { CartComponent } from '../../components/cart/cart.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { message } from '../../utils/error-message';

@Component({
  selector: 'app-store',
  imports: [FormsModule, CartComponent, ProductCardComponent],
  templateUrl: './store.page.html',
})
export class StorePage implements OnInit {
  private readonly api = inject(ApiService);
  readonly cart = inject(CartService);
  readonly categories = categories;
  readonly products = signal<Product[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  search = '';
  category = '';
  private latestRequestId = 0;
  private filters = { category: '', search: '' };

  browse() {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async ngOnInit() {
    await Promise.all([
      this.loadProducts(),
      this.cart.load().catch((error) => this.error.set(message(error))),
    ]);
  }

  filter(category: string) {
    this.category = category;
    this.search = '';
    void this.loadProducts();
  }

  async loadProducts(append = false) {
    const cursor = append ? this.nextCursor() : null;
    if (append && (!cursor || this.loading())) return;
    if (!append) {
      this.filters = { category: this.category, search: this.search };
      this.nextCursor.set(null);
    }
    const requestId = ++this.latestRequestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.api.products(
        this.filters.category,
        this.filters.search,
        cursor ?? undefined,
      );
      if (requestId === this.latestRequestId) {
        this.products.update((products) =>
          append ? [...products, ...page.products] : page.products,
        );
        this.nextCursor.set(page.nextCursor ?? null);
      }
    } catch (error) {
      if (requestId === this.latestRequestId) {
        this.error.set(message(error));
      }
    } finally {
      if (requestId === this.latestRequestId) {
        this.loading.set(false);
      }
    }
  }

  async add(product: Product) {
    this.error.set('');
    try {
      await this.cart.add(product);
    } catch (error) {
      this.error.set(message(error));
    }
  }
}
