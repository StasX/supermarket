import { Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CheckoutForm } from '../../models/checkout-form';

@Component({
  selector: 'fieldset[app-checkout-shipping]',
  imports: [ReactiveFormsModule],
  templateUrl: './checkout-shipping.component.html',
})
export class CheckoutShippingComponent {
  readonly form = input.required<CheckoutForm>();
  readonly today = input.required<string>();
  readonly autofill = output<'city' | 'street'>();
}
