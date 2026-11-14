import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { message } from '../../utils/error-message';

@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, FormsModule, RouterLink],
  templateUrl: './cart.component.html',
})
export class CartComponent {
  readonly cart = inject(CartService);
  readonly error = signal('');

  async quantity(id: string, count: number) {
    this.error.set('');
    try {
      await this.cart.quantity(id, count);
    } catch (error) {
      this.error.set(message(error));
    }
  }

  async remove(id: string) {
    this.error.set('');
    try {
      await this.cart.remove(id);
    } catch (error) {
      this.error.set(message(error));
    }
  }
}
