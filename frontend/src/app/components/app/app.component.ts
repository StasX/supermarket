import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly busy = signal(false);

  async logout() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.logout();
      this.cart.clear();
      await this.router.navigateByUrl('/login');
    } catch {
      this.error.set('Sign out failed. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
