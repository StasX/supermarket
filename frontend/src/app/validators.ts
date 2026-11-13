import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
export const priceValidator: ValidatorFn = (control) =>
  /^\d+\.\d{2}$/.test(String(control.value ?? '')) ? null : { price: true };
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const namePattern = /^(([A-Z][a-z]+)(((\s)[A-Z]([a-z])+)+)*)$/;
export const streetPattern = /^(([A-Z0-9][a-z0-9]+)(((\s)[A-Z0-9]([a-z0-9])+)+)*)$/;
export function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  return control.get('pass')?.value === control.get('confirm')?.value
    ? null
    : { passwordMismatch: true };
}
