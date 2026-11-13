import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { CartService } from './cart.service';

@Component({
  selector: 'app-root', imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="announcement">A little fresher. A little simpler. A shop that feels like home.</div>
    <header>
      <a class="brand" [routerLink]="auth.user() ? (auth.user()?.role === 1 ? '/management' : '/store') : '/login'">
        <img class="brand-mark" src="assets/img/logo.png" alt="Green dragon wearing a cap and jacket, pushing a shopping cart filled with groceries">
        <span>dragon<span class="brand-suffix">shop.</span><small>YOUR EVERYDAY MARKET</small></span>
      </a>
      <nav aria-label="Main navigation">
        @if (auth.user(); as user) {
          @if (user.role !== 0) { <a routerLink="/management" routerLinkActive="active">Manage products</a> }
          <span class="user-chip"><span class="avatar" aria-hidden="true">{{ user.name.charAt(0) }}</span>{{ user.name }}</span>
          <button class="secondary signout" type="button" (click)="logout()" [disabled]="busy()">Sign out</button>
        } @else { <a routerLink="/login" routerLinkActive="active">Sign in</a><a class="button signup-link" routerLink="/sign-up">Join the market <span aria-hidden="true">↗</span></a> }
      </nav>
    </header>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <main><router-outlet /></main>
    <footer><a class="footer-brand" [routerLink]="auth.user() ? '/store' : '/login'"><img src="assets/img/logo.png" alt="">dragonshop.</a><span>Good ingredients. Everyday inspiration.</span><span>Make yourself at home.</span></footer>
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService); private readonly cart = inject(CartService); private readonly router = inject(Router);
  readonly error = signal(''); readonly busy = signal(false);
  async logout() {
    this.busy.set(true); this.error.set('');
    try { await this.auth.logout(); this.cart.clear(); await this.router.navigateByUrl('/login'); }
    catch { this.error.set('Sign out failed. Please try again.'); }
    finally { this.busy.set(false); }
  }
}
