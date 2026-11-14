import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
export const priceValidator: ValidatorFn = (control) =>
  /^\d+\.\d{2}$/.test(String(control.value ?? '')) ? null : { price: true };
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const namePattern =
  /^(?=.{1,150}$)\p{L}[\p{L}\p{M}]*(?:[ '\u2019\u02bc\-\u2010\u2011][\p{L}\p{M}]+)*$/u;
export const streetPattern =
  /^(?=.{1,150}$)(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} '\u2019\u02bc\-\u2010\u2011.,/#]+$/u;
export function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  return control.get('pass')?.value === control.get('confirm')?.value
    ? null
    : { passwordMismatch: true };
}
