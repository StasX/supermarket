import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-order',
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './order.page.html',
})
export class OrderPage implements OnInit {
  readonly cart = inject(CartService);
  readonly error = signal('');

  async ngOnInit() {
    try {
      await this.cart.load();
    } catch {
      this.error.set('Unable to load your order. Please try again.');
    }
  }
}
