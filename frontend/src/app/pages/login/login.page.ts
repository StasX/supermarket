import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { emailPattern } from '../../validators/validators';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html',
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
