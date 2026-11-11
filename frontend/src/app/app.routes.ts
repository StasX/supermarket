import { Routes } from '@angular/router';
import { LoginPage, SignupPage } from './auth.pages';
import { sessionGuard } from './auth.service';
import { AboutPage, CheckoutPage, InfoPage, OrderPage, WelcomePage } from './customer.pages';
import { ManagementPage, StorePage } from './store.pages';

export const routes: Routes = [
  { path: 'login', component: LoginPage, title: 'Login to Dragon shop' },
  { path: 'sign-up', component: SignupPage, title: 'Sign up to Dragon shop' },
  { path: 'sign-up/1', redirectTo: 'sign-up', pathMatch: 'full' },
  { path: 'sign-up/2', redirectTo: 'sign-up', pathMatch: 'full' },
  { path: 'sign-up/sign-up/1', redirectTo: 'sign-up', pathMatch: 'full' },
  { path: 'sign-up/sign-up/2', redirectTo: 'sign-up', pathMatch: 'full' },
  { path: 'about', component: AboutPage, title: 'About us', canActivate: [sessionGuard], data: { role: 0 } },
  { path: 'info', component: InfoPage, title: 'Info', canActivate: [sessionGuard], data: { role: 0 } },
  { path: 'welcome', component: WelcomePage, title: 'Welcome to Dragon shop', canActivate: [sessionGuard], data: { role: 0 } },
  { path: 'store', component: StorePage, title: 'Dragon shop', canActivate: [sessionGuard], data: { role: 0 } },
  { path: 'order', redirectTo: 'order/cart', pathMatch: 'full' },
  { path: 'order/cart', component: OrderPage, title: 'Order', canActivate: [sessionGuard], data: { role: 0 } },
  { path: 'order/order/cart', redirectTo: 'order/cart', pathMatch: 'full' },
  { path: 'order/order/payment', redirectTo: 'order/payment', pathMatch: 'full' },
  { path: 'order/payment', component: CheckoutPage, title: 'Order', canActivate: [sessionGuard], data: { role: 0 } },
  { path: 'management', component: ManagementPage, title: 'Product manager', canActivate: [sessionGuard], data: { role: 1 } },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
