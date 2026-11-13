import { AbstractControl } from '@angular/forms';

export function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shippingDateValidator(control: AbstractControl) {
  const value = control.value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { shippingDate: true };
  }
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value && value >= localDate()
    ? null
    : { shippingDate: true };
}

export function expiryValidator(control: AbstractControl) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(control.value || '');
  if (!match) {
    return { expiry: true };
  }
  const today = new Date();
  const expiryYear = Number(match[2]) + 2000;
  const expiryMonth = Number(match[1]);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const isCurrentOrFutureMonth =
    expiryYear > currentYear || (expiryYear === currentYear && expiryMonth >= currentMonth);
  return isCurrentOrFutureMonth ? null : { expiry: true };
}
