import { Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CheckoutForm } from '../../models/checkout-form';

@Component({
  selector: 'fieldset[app-checkout-payment]',
  imports: [ReactiveFormsModule],
  templateUrl: './checkout-payment.component.html',
})
export class CheckoutPaymentComponent {
  readonly form = input.required<CheckoutForm>();
  readonly autofill = output<'cardholder'>();
}
