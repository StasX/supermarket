import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, CheckoutOrder } from './api.service';
import { CartService } from './cart.service';
import { AuthService } from './auth.service';
import { expiryValidator, localDate, shippingDateValidator } from './checkout.validators';

@Component({
  selector: 'app-checkout',
  imports: [RouterLink, ReactiveFormsModule, CurrencyPipe],
  template: `<section class="panel checkout">
    @if (completed(); as order) {
      <div class="checkout-success" role="status">
        <h1>Your order success!</h1>
        <p>
          Download invoice
          <a [href]="order.invoiceUrl" [download]="'invoice-' + order.id + '.pdf'">here</a>.
        </p>
      </div>
    } @else {
      <span class="eyebrow">THE LAST LITTLE DETAILS</span>
      <h1>Checkout</h1>
      @if (loading()) {
        <p role="status">Loading your order…</p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (!loading() && cart.items().length) {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <fieldset [disabled]="saving()">
            <legend>Shipping details</legend>
            <div class="checkout-fields">
              <label
                >City<input
                  formControlName="city"
                  (dblclick)="autofill('city')"
                  autocomplete="shipping address-level2"
                  maxlength="150"
                  required
              /></label>
              <label
                >Street<input
                  formControlName="street"
                  (dblclick)="autofill('street')"
                  autocomplete="shipping street-address"
                  maxlength="150"
                  required
              /></label>
              <label
                >Shipping date<input type="date" formControlName="date" [min]="today" required
              /></label>
            </div>
          </fieldset>
          <fieldset [disabled]="saving()">
            <legend>Payment</legend>
            <div class="checkout-fields">
              <label
                >Cardholder name<input
                  formControlName="cardholder"
                  (dblclick)="autofill('cardholder')"
                  autocomplete="off"
                  maxlength="100"
                  required
              /></label>
              <label
                >Card number<input
                  formControlName="number"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="5800 5800 5800 5800"
                  required
              /></label>
              <label
                >Expiry date<input
                  formControlName="expiry"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="MM/YY"
                  maxlength="5"
                  required
              /></label>
              <label
                >Security code<input
                  type="password"
                  formControlName="cvc"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="123"
                  maxlength="3"
                  required
              /></label>
            </div>
          </fieldset>
          <p class="total">Total: {{ cart.total() | currency: 'USD' }}</p>
          <div class="actions">
            <button type="submit" [disabled]="saving() || cart.busy()">
              {{ saving() ? 'Placing order…' : 'Order' }}
            </button>
          </div>
        </form>
      } @else if (!loading()) {
        <p>Your cart is empty.</p>
        <a class="button" routerLink="/store">Return to store</a>
      }
    }
  </section>`,
})
export class CheckoutPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly today = localDate();
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly completed = signal<CheckoutOrder | null>(null);
  readonly form = this.fb.nonNullable.group({
    city: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    street: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    date: ['', [Validators.required, shippingDateValidator]],
    cardholder: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    number: ['', [Validators.required, Validators.pattern(/^ *(?:[0-9] *){16}$/)]],
    expiry: ['', [Validators.required, expiryValidator]],
    cvc: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
  });

  autofill(field: 'city' | 'street' | 'cardholder') {
    const control = this.form.controls[field];
    if (this.saving() || control.value.trim()) {
      return;
    }
    const user = this.auth.user();
    const value = field === 'cardholder' ? user?.name : user?.address?.[field];
    if (typeof value !== 'string' || !value.trim()) {
      return;
    }
    control.setValue(value.trim());
    control.markAsDirty();
  }

  async ngOnInit() {
    try {
      await this.cart.load();
    } catch {
      this.error.set('Unable to load your order. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async submit() {
    if (this.loading() || this.saving() || this.completed()) {
      return;
    }
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set(
        'Enter city, street, today or a future shipping date, and valid demo card details.',
      );
      return;
    }
    const cartId = this.cart.id();
    if (!cartId || !this.cart.items().length) {
      this.error.set('Add products before checking out.');
      return;
    }
    this.saving.set(true);
    try {
      const { city, street, date, number } = this.form.getRawValue();
      const result = await this.api.checkout({
        cartId,
        shipping: { city: city.trim(), street: street.trim(), date },
        payment: { method: 'credit_card', last4: number.replace(/ /g, '').slice(-4) },
      });
      if (!result.success || !result.order) {
        throw new Error(result.reason || 'Order could not be placed. Please try again.');
      }
      const order = result.order;
      this.completed.set(order);
      this.cart.clear();
      this.form.reset();
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Order could not be placed. Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
