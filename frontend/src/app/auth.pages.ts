import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { CartService } from './cart.service';
import { emailPattern, namePattern, passwordsMatch, streetPattern } from './validators';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-layout">
      <aside class="auth-story">
        <span class="eyebrow">THE EVERYDAY, MADE BETTER</span>
        <h2>Good food.<br />Great little<br /><em>moments.</em></h2>
        <p>Fill your basket with favourites.<br />Make room for something delicious.</p>
        <img
          class="market-art"
          src="assets/img/market-basket.svg"
          alt="An illustrated basket of fresh groceries"
        />
        <div class="story-note">
          <span aria-hidden="true">✳</span><span>A fresh take on your everyday shop.</span>
        </div>
      </aside>
      <section class="panel auth-panel">
        <span class="eyebrow">WELCOME TO THE NEIGHBOURHOOD</span>
        <h1>Sign in</h1>
        <p class="auth-subtitle">Your favourites are just a basket away.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label
            >Email<input type="email" formControlName="username" autocomplete="username" required
          /></label>
          <label
            >Password<input
              type="password"
              formControlName="password"
              autocomplete="current-password"
              required
          /></label>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <button type="submit" [disabled]="busy()">
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
        <p class="auth-switch">
          New customer?
          <a routerLink="/sign-up">Create an account <span aria-hidden="true">↗</span></a>
        </p>
        <div class="form-footnote">
          <span aria-hidden="true">◈</span> Your next good meal starts here.
        </div>
      </section>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(emailPattern)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  readonly error = signal('');
  readonly busy = signal(false);

  async submit() {
    if (this.busy()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter a valid email and a password of at least 8 characters.');
      return;
    }
    this.error.set('');
    this.busy.set(true);
    try {
      const { username, password } = this.form.getRawValue();
      if (!(await this.auth.login(username, password))) {
        this.error.set('Email or password is incorrect.');
        return;
      }
      this.cart.clear();
      await this.router.navigateByUrl(this.auth.user()?.role === 1 ? '/management' : '/about');
    } catch {
      this.error.set('Unable to sign in. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-layout signup-layout">
      <aside class="auth-story">
        <span class="eyebrow">A PLACE IN YOUR DAILY ROUTINE</span>
        <h2>Meet your<br />new favourite<br /><em>market.</em></h2>
        <p>A basket of possibilities.<br />A little inspiration for every day.</p>
        <img
          class="market-art"
          src="assets/img/market-basket.svg"
          alt="An illustrated basket of fresh groceries"
        />
      </aside>
      <section class="panel auth-panel">
        <span class="eyebrow">LET’S MAKE YOU FEEL AT HOME</span>
        <h1>Create an account</h1>
        <div class="signup-progress">
          <span [class.current]="step() === 1">01 <span>Your account</span></span
          ><i></i><span [class.current]="step() === 2">02 <span>Your details</span></span>
        </div>
        <p class="step-label">Step {{ step() }} of 2</p>
        @if (step() === 1) {
          <form [formGroup]="account" (ngSubmit)="next()">
            <label
              >ID number<input formControlName="id" inputmode="numeric" maxlength="9" required
            /></label>
            <label
              >Email<input type="email" formControlName="email" autocomplete="email" required
            /></label>
            <label
              >Password<input
                type="password"
                formControlName="pass"
                autocomplete="new-password"
                required
            /></label>
            <label
              >Confirm password<input
                type="password"
                formControlName="confirm"
                autocomplete="new-password"
                required
            /></label>
            <p class="hint">Use a 9-digit ID and a password of at least 8 characters.</p>
            <button type="submit">Continue</button>
          </form>
        } @else {
          <form [formGroup]="details" (ngSubmit)="submit()">
            <label
              >First name<input formControlName="firstName" autocomplete="given-name" required
            /></label>
            <label
              >Last name<input formControlName="lastName" autocomplete="family-name" required
            /></label>
            <label
              >City<select formControlName="city" required>
                <option value="">Select a city</option>
                @for (city of cities; track city) {
                  <option [value]="city">{{ city }}</option>
                }
              </select></label
            >
            <label
              >Street<input formControlName="street" autocomplete="street-address" required
            /></label>
            <p class="hint">
              Use capitalized English names and addresses, as required by the current API.
            </p>
            <div class="actions">
              <button type="button" class="secondary" (click)="back()" [disabled]="busy()">
                Back
              </button>
              <button type="submit" [disabled]="busy()">
                {{ busy() ? 'Creating…' : 'Create account' }}
              </button>
            </div>
          </form>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <p><a class="return-link" routerLink="/login">Back to sign in</a></p>
      </section>
    </div>
  `,
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
