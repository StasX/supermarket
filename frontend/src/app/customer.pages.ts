import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from './api.service';
import { CartService } from './cart.service';

@Component({
  selector: 'app-about', imports: [RouterLink],
  template: `<section class="panel intro"><span class="eyebrow">YOUR NEIGHBOURHOOD, IN A BASKET</span><img src="assets/img/market-basket.svg" alt="A basket of market favourites"><h1>Welcome to Dragon shop</h1>
    <p>A few everyday essentials. A new favourite or two. Find the ingredients for your next good meal, all in one place.</p>
    <div class="actions"><a class="button" routerLink="/store">Start shopping</a><a routerLink="/info">Shop information</a></div></section>`,
})
export class AboutPage {}

@Component({
  selector: 'app-info', imports: [RouterLink],
  template: `<section class="panel"><span class="eyebrow">A PEEK INSIDE THE MARKET</span><h1>Shop information</h1>
    @if (loading()) {<p role="status">Loading shop information…</p>} @else {
      <div class="stats"><p><strong>{{ products() }}</strong> products available</p><p><strong>{{ orders() }}</strong> orders placed</p></div>
    }
    @if (error()) {<p class="error" role="alert">{{ error() }}</p>}
    <a class="button" routerLink="/store">Start shopping</a></section>`,
})
export class InfoPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly products = signal(0); readonly orders = signal(0); readonly error = signal(''); readonly loading = signal(true);
  async ngOnInit() {
    try {
      const [products, orders] = await Promise.all([this.api.count('products'), this.api.count('orders')]);
      if (!products.success || !orders.success) throw new Error();
      this.products.set(products.productsCount ?? 0); this.orders.set(orders.ordersCount ?? 0);
    } catch { this.error.set('Unable to load shop information. Please try again.'); }
    finally { this.loading.set(false); }
  }
}

@Component({
  selector: 'app-welcome', imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `<section class="panel"><span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h1>Welcome to Dragon shop</h1>
    @if (cart.busy()) {<p role="status">Loading your cart…</p>} @else if (cart.items().length) {
      <p>You have an open shopping cart.</p>@if (cart.created()) {<p>Cart opened {{ cart.created() | date:'mediumDate' }}.</p>}
      <p>Total: {{ cart.total() | currency:'USD' }}</p>
    } @else {<p>Your next shopping trip starts here.</p>}
    @if (error()) {<p class="error" role="alert">{{ error() }}</p>}
    <a class="button" routerLink="/store">{{ cart.items().length ? 'Continue shopping' : 'Start shopping' }}</a></section>`,
})
export class WelcomePage implements OnInit {
  readonly cart = inject(CartService); readonly error = signal('');
  async ngOnInit() { try { await this.cart.load(); } catch { this.error.set('Unable to load your cart. Please try again.'); } }
}

@Component({
  selector: 'app-order', imports: [RouterLink, CurrencyPipe],
  template: `<section class="panel"><span class="eyebrow">YOUR GOOD THINGS, ALL TOGETHER</span><h1>Review your order</h1>
    @if (cart.busy()) {<p role="status">Loading your cart…</p>}
    @if (error()) {<p class="error" role="alert">{{ error() }}</p>}
    @if (cart.lines().length) {
      <table><thead><tr><th>Product</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>@for (item of cart.lines(); track item.id) {<tr><td>{{ item.name }}</td><td>{{ item.count }}</td><td>{{ item.price | currency:'USD' }}</td><td>{{ item.price * item.count | currency:'USD' }}</td></tr>}</tbody></table>
      <p class="total">Total: {{ cart.total() | currency:'USD' }}</p><a class="button" routerLink="/order/payment">Continue to checkout</a>
    } @else {<p>Your cart is empty.</p>}
    <p><a routerLink="/store">Continue shopping</a></p></section>`,
})
export class OrderPage implements OnInit {
  readonly cart = inject(CartService); readonly error = signal('');
  async ngOnInit() { try { await this.cart.load(); } catch { this.error.set('Unable to load your order. Please try again.'); } }
}

@Component({
  selector: 'app-checkout', imports: [RouterLink],
  template: `<section class="panel"><span class="eyebrow">A LITTLE SOMETHING FOR LATER</span><h1>Checkout</h1><p>Online checkout is not available yet. Your shopping cart is saved.</p>
    <a class="button" routerLink="/store">Return to store</a></section>`,
})
export class CheckoutPage {}
