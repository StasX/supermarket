import { inject, Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService, User } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  readonly user = signal<User | null>(null);
  private reconnecting?: Promise<User | null>;
  async login(username: string, password: string) {
    const result = await this.api.login(username, password);
    if (!result.success || result.user === undefined || result.role === undefined) return false;
    this.user.set({ user: result.user, role: result.role, name: result.name ?? '', address: result.address, isReturning: result.isReturning });
    return true;
  }
  async reconnect() {
    if (this.user()) return this.user();
    if (this.reconnecting) return this.reconnecting;
    this.reconnecting = this.api.reconnect().then(result => {
      if (result.success && result.user && result.role !== undefined) {
        const name = typeof result.name === 'object' ? `${result.name.first_name} ${result.name.last_name}` : result.name ?? '';
        this.user.set({ user: result.user, role: result.role, name, address: result.address, isReturning: result.isReturning });
      }
      return this.user();
    }).catch(() => null).finally(() => { this.reconnecting = undefined; });
    return this.reconnecting;
  }
  async logout() {
    const result = await this.api.logout();
    if (!result.success) throw new Error('Sign out failed. Please try again.');
    this.user.set(null);
  }
}
export const sessionGuard: CanActivateFn = async route => {
  const auth = inject(AuthService); const router = inject(Router);
  const user = await auth.reconnect();
  return user && user.role === route.data['role'] ? true : router.parseUrl('/login');
};
