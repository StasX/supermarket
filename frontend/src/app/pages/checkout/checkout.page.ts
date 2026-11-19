import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CheckoutOrder } from '../../models/api.models';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { CheckoutShippingComponent } from '../../components/checkout-shipping/checkout-shipping.component';
import { CheckoutPaymentComponent } from '../../components/checkout-payment/checkout-payment.component';
import { CheckoutForm } from '../../models/checkout-form';
import {
  expiryValidator,
  localDate,
  shippingDateValidator,
} from '../../validators/checkout.validators';

@Component({
  selector: 'app-checkout',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    CurrencyPipe,
    CheckoutShippingComponent,
    CheckoutPaymentComponent,
  ],
  templateUrl: './checkout.page.html',
})
export class CheckoutPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly reviewedLines = computed(() =>
    this.cart.lines().map(({ id, name, count, price }) => ({
      id,
      name,
      count,
      unitPriceCents: Math.round(price * 100),
    })),
  );
  readonly reviewedTotal = computed(
    () =>
      this.reviewedLines().reduce((sum, item) => sum + item.count * item.unitPriceCents, 0) / 100,
  );
  readonly today = localDate();
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly completed = signal<CheckoutOrder | null>(null);
  readonly form: CheckoutForm = this.fb.nonNullable.group({
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
        reviewedItems: this.reviewedLines().map(({ id, count, unitPriceCents }) => ({
          id,
          count,
          unitPriceCents,
        })),
        shipping: { city: city.trim(), street: street.trim(), date },
        payment: { method: 'credit_card', last4: number.replace(/ /g, '').slice(-4) },
      });
      if (!result.success || !result.order) {
        if (result.review && this.cart.id() === cartId) {
          this.cart.items.set(result.review.products);
        }
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
