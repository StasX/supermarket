import { AbstractControl } from '@angular/forms';

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shippingDateValidator(control: AbstractControl) {
  const value = control.value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { shippingDate: true };
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value && value >= localDate() ? null : { shippingDate: true };
}

export function expiryValidator(control: AbstractControl) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(control.value || '');
  if (!match) return { expiry: true };
  const today = new Date();
  return Number(match[2]) + 2000 > today.getFullYear() ||
    (Number(match[2]) + 2000 === today.getFullYear() && Number(match[1]) >= today.getMonth() + 1) ? null : { expiry: true };
}
