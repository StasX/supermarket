import { FormControl, FormGroup } from '@angular/forms';

export type CheckoutForm = FormGroup<{
  [
    Field in 'city' | 'street' | 'date' | 'cardholder' | 'number' | 'expiry' | 'cvc'
  ]: FormControl<string>;
}>;
