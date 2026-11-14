import { Component, inject, signal } from '@angular/core';
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

  next() {
    if (this.account.invalid) {
      this.account.markAllAsTouched();
      this.error.set('Check your ID, email, password, and password confirmation.');
      return;
    }
    this.error.set('');
    this.step.set(2);
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
      if (result.created) {
        await this.router.navigateByUrl('/login');
      } else {
        this.error.set(result.reason ?? 'Unable to create your account.');
      }
    } catch {
      this.error.set('Unable to create your account. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
