import { Routes } from '@angular/router';
import { LoginPage } from '../pages/login/login.page';
import { SignupPage } from '../pages/signup/signup.page';
import { sessionGuard } from '../guards/session.guard';
import { AboutPage } from '../pages/about/about.page';
import { InfoPage } from '../pages/info/info.page';
import { OrderPage } from '../pages/order/order.page';
import { WelcomePage } from '../pages/welcome/welcome.page';
import { CheckoutPage } from '../pages/checkout/checkout.page';
import { ManagementPage } from '../pages/management/management.page';
import { StorePage } from '../pages/store/store.page';

export const routes: Routes = [
  { path: 'login', component: LoginPage, title: 'Login to Dragon shop' },
  { path: 'sign-up', component: SignupPage, title: 'Sign up to Dragon shop' },
  { path: 'sign-up/1', redirectTo: 'sign-up', pathMatch: 'full' },
  { path: 'sign-up/2', redirectTo: 'sign-up', pathMatch: 'full' },
  { path: 'sign-up/sign-up/1', redirectTo: 'sign-up', pathMatch: 'full' },
  { path: 'sign-up/sign-up/2', redirectTo: 'sign-up', pathMatch: 'full' },
  {
    path: 'about',
    component: AboutPage,
    title: 'About us',
    canActivate: [sessionGuard],
    data: { role: 0 },
  },
  {
    path: 'info',
    component: InfoPage,
    title: 'Info',
    canActivate: [sessionGuard],
    data: { role: 0 },
  },
  {
    path: 'welcome',
    component: WelcomePage,
    title: 'Welcome to Dragon shop',
    canActivate: [sessionGuard],
    data: { role: 0 },
  },
  {
    path: 'store',
    component: StorePage,
    title: 'Dragon shop',
    canActivate: [sessionGuard],
    data: { role: 0 },
  },
  { path: 'order', redirectTo: 'order/cart', pathMatch: 'full' },
  {
    path: 'order/cart',
    component: OrderPage,
    title: 'Order',
    canActivate: [sessionGuard],
    data: { role: 0 },
  },
  { path: 'order/order/cart', redirectTo: 'order/cart', pathMatch: 'full' },
  { path: 'order/order/payment', redirectTo: 'order/payment', pathMatch: 'full' },
  {
    path: 'order/payment',
    component: CheckoutPage,
    title: 'Order',
    canActivate: [sessionGuard],
    data: { role: 0 },
  },
  {
    path: 'management',
    component: ManagementPage,
    title: 'Product manager',
    canActivate: [sessionGuard],
    data: { role: 1 },
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
