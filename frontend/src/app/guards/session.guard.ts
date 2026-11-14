import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const sessionGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.reconnect();
  return user && user.role === route.data['role'] ? true : router.parseUrl('/login');
};
