import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-info',
  imports: [RouterLink],
  templateUrl: './info.page.html',
})
export class InfoPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly products = signal(0);
  readonly orders = signal(0);
  readonly error = signal('');
  readonly loading = signal(true);

  async ngOnInit() {
    try {
      const [products, orders] = await Promise.all([
        this.api.count('products'),
        this.api.count('orders'),
      ]);
      if (!products.success || !orders.success) {
        throw new Error();
      }
      this.products.set(products.productsCount ?? 0);
      this.orders.set(orders.ordersCount ?? 0);
    } catch {
      this.error.set('Unable to load shop information. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
