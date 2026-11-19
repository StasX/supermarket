import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import {
  emailPattern,
  namePattern,
  passwordsMatch,
  streetPattern,
} from '../../validators/validators';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.page.html',
})
export class SignupPage {
  private readonly builder = inject(FormBuilder).nonNullable;
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly step = signal(1);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly cities = [
    'Jerusalem',
    'Beersheba',
    'Arad',
    'Eilat',
    'Haifa',
    'Rishon LeZion',
    'Tel Aviv',
    'Modiin',
    'Hadera',
    'Maale Adumim',
  ];
  readonly account = this.builder.group(
    {
      id: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
      email: ['', [Validators.required, Validators.pattern(emailPattern)]],
      pass: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );
  readonly details = this.builder.group({
    firstName: ['', [Validators.required, Validators.pattern(namePattern)]],
    lastName: ['', [Validators.required, Validators.pattern(namePattern)]],
    city: ['', [Validators.required, Validators.pattern(namePattern)]],
    street: ['', [Validators.required, Validators.pattern(streetPattern)]],
  });

  async next() {
    if (this.busy()) return;
    if (this.account.invalid) {
      this.account.markAllAsTouched();
      this.error.set('Check your ID, email, password, and password confirmation.');
      return;
    }
    this.error.set('');
    this.busy.set(true);
    const { email, id } = this.account.getRawValue();
    try {
      const result = await this.api.checkSignup({ email, id });
      const current = this.account.getRawValue();
      if (current.email !== email || current.id !== id || this.account.invalid) {
        this.error.set('Your account details changed. Please press Continue again.');
        return;
      }
      if (!result.success || !result.available) {
        this.error.set(result.reason || 'Unable to verify your email and ID. Please try again.');
        return;
      }
      this.step.set(2);
    } catch (error) {
      this.showRequestError(error);
    } finally {
      this.busy.set(false);
    }
  }

  back() {
    this.error.set('');
    this.step.set(1);
  }

  async submit() {
    if (this.busy()) {
      return;
    }
    if (this.details.invalid || this.account.invalid) {
      this.error.set('Complete all fields with valid details.');
      return;
    }
    this.error.set('');
    this.busy.set(true);
    try {
      const { confirm: _confirm, ...account } = this.account.getRawValue();
      const result = await this.api.signup({ ...account, ...this.details.getRawValue() });
      if (result.success) {
        await this.router.navigateByUrl('/login');
      } else {
        this.error.set(result.reason ?? 'Unable to create your account.');
      }
    } catch (error) {
      this.showRequestError(error);
    } finally {
      this.busy.set(false);
    }
  }

  private showRequestError(error: unknown) {
    let reason = 'Unable to create your account. Please try again.';
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        reason = 'Unable to reach the server. Check your connection and try again.';
      } else if (error.status === 403) {
        reason = 'Your session could not be verified. Refresh the page and try again.';
      } else if (error.status === 429) {
        const seconds = Number(error.headers.get('Retry-After'));
        reason =
          Number.isFinite(seconds) && seconds > 0
            ? `Too many signup attempts. Try again in ${Math.ceil(seconds / 60)} minute(s).`
            : 'Too many signup attempts. Please try again later.';
      } else if (error.status === 503) {
        reason = 'Signup is temporarily unavailable. Please try again shortly.';
      }
    }
    this.error.set(reason);
  }
}
