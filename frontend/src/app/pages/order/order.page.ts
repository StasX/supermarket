import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-order',
  imports: [RouterLink, CurrencyPipe, FormsModule],
  templateUrl: './order.page.html',
  styleUrl: './order.page.scss',
})
export class OrderPage implements OnInit {
  readonly cart = inject(CartService);
  readonly error = signal('');
  readonly search = signal('');
  readonly highlightedLines = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.cart.lines().map((item) => ({
      ...item,
      matched: Boolean(query) && item.name.toLocaleLowerCase().includes(query),
    }));
  });

  async ngOnInit() {
    try {
      await this.cart.load();
    } catch {
      this.error.set('Unable to load your order. Please try again.');
    }
  }
}
