import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, CheckoutOrder } from './api.service';
import { CartService } from './cart.service';
import { expiryValidator, localDate, shippingDateValidator } from './checkout.validators';

@Component({
  selector: 'app-checkout', imports: [RouterLink, ReactiveFormsModule, CurrencyPipe, DatePipe],
  template: `<section class="panel checkout"><span class="eyebrow">THE LAST LITTLE DETAILS</span><h1>Checkout</h1>
    @if (completed(); as order) {
      <div role="status"><h2>Demo order confirmed</h2><p>Order {{ order.id }}</p>
        <p>Shipping to {{ order.shipping.street }}, {{ order.shipping.city }} on {{ order.shipping.date | date:'mediumDate':'UTC' }}.</p>
        <p>Total: {{ order.total | currency:'USD' }} · Credit card ending {{ order.payment.last4 }}</p>
        <p>No payment was charged.</p></div><a class="button" routerLink="/store">Continue shopping</a>
    } @else {
      @if (!saving()) {<p><a routerLink="/order/cart">Back to order review</a></p>}
      @if (loading()) {<p role="status">Loading your order…</p>}
      @if (error()) {<p class="error" role="alert">{{ error() }}</p>}
      @if (!loading() && cart.items().length) {
        <p class="checkout-demo">Demo checkout — no charge. Use test card <strong>4242 4242 4242 4242</strong>, a future expiry date, and any three-digit security code. Do not enter real card details.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <fieldset [disabled]="saving()"><legend>Shipping details</legend><div class="checkout-fields">
            <label>City<input formControlName="city" autocomplete="shipping address-level2" maxlength="150" required></label>
            <label>Street<input formControlName="street" autocomplete="shipping street-address" maxlength="150" required></label>
            <label>Shipping date<input type="date" formControlName="date" [min]="today" required></label>
          </div></fieldset>
          <fieldset [disabled]="saving()"><legend>Payment · Credit card</legend><div class="checkout-fields">
            <label>Cardholder name<input formControlName="cardholder" autocomplete="off" maxlength="100" required></label>
            <label>Card number<input formControlName="number" inputmode="numeric" autocomplete="off" placeholder="4242 4242 4242 4242" maxlength="19" required></label>
            <label>Expiry date<input formControlName="expiry" inputmode="numeric" autocomplete="off" placeholder="MM/YY" maxlength="5" required></label>
            <label>Security code<input type="password" formControlName="cvc" inputmode="numeric" autocomplete="off" placeholder="123" maxlength="3" required></label>
          </div></fieldset>
          <p class="total">Total: {{ cart.total() | currency:'USD' }}</p>
          <div class="actions"><button type="submit" [disabled]="saving() || cart.busy()">{{ saving() ? 'Placing order…' : 'Order' }}</button></div>
        </form>
      } @else if (!loading()) {<p>Your cart is empty.</p><a class="button" routerLink="/store">Return to store</a>}
    }
  </section>`,
})
export class CheckoutPage implements OnInit {
  private readonly api = inject(ApiService); private readonly fb = inject(FormBuilder);
  readonly cart = inject(CartService); readonly today = localDate();
  readonly loading = signal(true); readonly saving = signal(false); readonly error = signal('');
  readonly completed = signal<CheckoutOrder | null>(null);
  readonly form = this.fb.nonNullable.group({
    city: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    street: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    date: ['', [Validators.required, shippingDateValidator]],
    cardholder: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    number: ['', [Validators.required, Validators.pattern(/^(4242424242424242|4242 4242 4242 4242)$/)]],
    expiry: ['', [Validators.required, expiryValidator]], cvc: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
  });
  async ngOnInit() {
    try { await this.cart.load(); }
    catch { this.error.set('Unable to load your order. Please try again.'); }
    finally { this.loading.set(false); }
  }
  async submit() {
    if (this.loading() || this.saving() || this.completed()) return;
    this.error.set(''); this.form.markAllAsTouched();
    if (this.form.invalid) { this.error.set('Enter city, street, today or a future shipping date, and valid demo card details.'); return; }
    const cartId = this.cart.id();
    if (!cartId || !this.cart.items().length) { this.error.set('Add products before checking out.'); return; }
    this.saving.set(true);
    try {
      const { city, street, date } = this.form.getRawValue();
      const result = await this.api.checkout({ cartId, shipping: { city: city.trim(), street: street.trim(), date }, payment: { method: 'credit_card', last4: '4242' } });
      if (!result.success || !result.order) throw new Error(result.reason || 'Order could not be placed. Please try again.');
      this.completed.set(result.order); this.cart.clear(); this.form.reset();
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Order could not be placed. Please try again.'); }
    finally { this.saving.set(false); }
  }
}
