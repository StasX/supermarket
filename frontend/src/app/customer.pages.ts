import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, OrderHistory } from './api.service';
import { CartService } from './cart.service';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-customer-welcome',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `<h1>{{ heading() }}</h1>
    @if (loading()) {
      <p role="status">Loading your shopping history…</p>
    } @else if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    } @else {
      @if (cart.id()) {
        <h2>Your open cart</h2>
        @if (cart.created()) {
          <p>Created at {{ cart.created() | date: 'medium' }}.</p>
        }
        @if (cart.lines().length) {
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              @for (item of cart.lines(); track item.id) {
                <tr>
                  <td>{{ item.name }}</td>
                  <td>{{ item.count }}</td>
                  <td>{{ item.price | currency: 'USD' }}</td>
                  <td>{{ item.price * item.count | currency: 'USD' }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p>Your cart is empty.</p>
        }
        <p class="total">Total: {{ cart.total() | currency: 'USD' }}</p>
      } @else if (lastOrder(); as order) {
        <h2>Your latest order</h2>
        <p>Order {{ order._id }}</p>
        @if (order.created_at) {
          <p>Ordered {{ order.created_at | date: 'medium' }}.</p>
        }
        @if (order.products?.length) {
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              @for (item of order.products; track $index) {
                <tr>
                  <td>{{ item.name || productName(item.id) }}</td>
                  <td>{{ item.count }}</td>
                  <td>{{ item.price | currency: 'USD' }}</td>
                  <td>{{ item.price * item.count | currency: 'USD' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
        @if (order.price !== undefined) {
          <p class="total">Total: {{ order.price | currency: 'USD' }}</p>
        }
      } @else {
        <p>Your next shopping trip starts here.</p>
      }
      <a class="button" routerLink="/store">{{
        cart.id() ? 'Continue shopping' : 'Start shopping'
      }}</a>
    }`,
})
export class CustomerWelcome implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly heading = signal('Welcome to Dragon shop');
  readonly lastOrder = signal<OrderHistory | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  productName(id: string) {
    return this.cart.catalog().find((product) => product.id === id)?.name ?? 'Unavailable product';
  }

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

@Component({
  selector: 'app-about',
  imports: [CustomerWelcome],
  template: `<section class="panel intro">
    <span class="eyebrow">YOUR NEIGHBOURHOOD, IN A BASKET</span
    ><img
      src="assets/img/market-basket.svg"
      alt="A basket of market favourites"
    /><app-customer-welcome />
  </section>`,
})
export class AboutPage {}

@Component({
  selector: 'app-info',
  imports: [RouterLink],
  template: `<section class="panel">
    <span class="eyebrow">A PEEK INSIDE THE MARKET</span>
    <h1>Shop information</h1>
    @if (loading()) {
      <p role="status">Loading shop information…</p>
    } @else {
      <div class="stats">
        <p>
          <strong>{{ products() }}</strong> products available
        </p>
        <p>
          <strong>{{ orders() }}</strong> orders placed
        </p>
      </div>
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <a class="button" routerLink="/store">Start shopping</a>
  </section>`,
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

@Component({
  selector: 'app-welcome',
  imports: [CustomerWelcome],
  template: `<section class="panel">
    <span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span><app-customer-welcome />
  </section>`,
})
export class WelcomePage {}

@Component({
  selector: 'app-order',
  imports: [RouterLink, CurrencyPipe],
  template: `<section class="panel">
    <span class="eyebrow">YOUR GOOD THINGS, ALL TOGETHER</span>
    <h1>Review your order</h1>
    @if (cart.busy()) {
      <p role="status">Loading your cart…</p>
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (cart.lines().length) {
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          @for (item of cart.lines(); track item.id) {
            <tr>
              <td>{{ item.name }}</td>
              <td>{{ item.count }}</td>
              <td>{{ item.price | currency: 'USD' }}</td>
              <td>{{ item.price * item.count | currency: 'USD' }}</td>
            </tr>
          }
        </tbody>
      </table>
      <p class="total">Total: {{ cart.total() | currency: 'USD' }}</p>
      <a class="button" routerLink="/order/payment">Continue to checkout</a>
    } @else {
      <p>Your cart is empty.</p>
    }
    <p><a class="return-link" routerLink="/store">Continue shopping</a></p>
  </section>`,
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
