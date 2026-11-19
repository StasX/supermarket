import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { OrderHistory } from '../../models/api.models';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-customer-welcome',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './customer-welcome.component.html',
})
export class CustomerWelcome implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly heading = signal('Welcome to Dragon shop');
  readonly lastOrder = signal<OrderHistory | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  async ngOnInit() {
    try {
      const [result] = await Promise.all([this.api.lastOrder(), this.cart.load()]);
      if (!result.success) {
        throw new Error();
      }
      this.lastOrder.set(result.order ?? null);
      const isReturning = this.auth.user()?.isReturning ?? Boolean(result.order);
      this.heading.set(
        isReturning ? 'Welcome back to Dragon shop' : 'Welcome to your first buy in Dragon shop',
      );
    } catch {
      this.error.set('Unable to load your shopping history. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
