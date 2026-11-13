import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiService, Product } from './api.service';
import { AuthService, sessionGuard } from './auth.service';
import { CartService } from './cart.service';
import { routes } from './app.routes';
import { AppComponent } from './app.component';
import { LoginPage, SignupPage } from './auth.pages';
import { ManagementPage } from './store.pages';
import { CheckoutPage } from './checkout.page';
import { emailPattern, passwordsMatch, priceValidator } from './validators';

const customer = { user: 'u1', name: 'John Smith', role: 0 };
const product: Product = { id: 'p1', name: 'Juice', price: 10.5, category: 'Wine & Drinks', image: 'https://example.com/juice.png' };
beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] }));
afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('form validation', () => {
  it.each(['0.00', '10.99'])('accepts price %s', value => expect(new FormControl(value, priceValidator).valid).toBe(true));
  it.each(['', '10', '1.1', '-1.00', 'abc'])('rejects price %s', value => expect(new FormControl(value, priceValidator).valid).toBe(false));
  it.each(['j.smith@example.com', 'user123@test.co.il'])('accepts email %s', value => expect(new FormControl(value, Validators.pattern(emailPattern)).valid).toBe(true));
  it.each(['user', 'user@', '@example.com', 'a b@example.com'])('rejects email %s', value => expect(new FormControl(value, Validators.pattern(emailPattern)).valid).toBe(false));
  it('checks confirmation against the current password', () => {
    const form = new FormGroup({ pass: new FormControl('password123'), confirm: new FormControl('password123') }, passwordsMatch);
    expect(form.valid).toBe(true); form.controls.pass.setValue('updated'); expect(form.valid).toBe(false);
    form.controls.confirm.setValue('updated'); expect(form.valid).toBe(true);
  });
});

describe('API compatibility', () => {
  it('uploads an image as multipart form data', async () => {
    const file = new File(['image'], 'cheese.png', { type: 'image/png' });
    const promise = TestBed.inject(ApiService).uploadProductImage(file);
    const request = TestBed.inject(HttpTestingController).expectOne('/upload-product-image');
    expect(request.request.body.get('image')).toBe(file);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({ success: true, image: '/products/test.png' });
    expect((await promise).image).toBe('/products/test.png');
  });
  it('normalizes category product ids and prices', async () => {
    const promise = TestBed.inject(ApiService).products('Wine & Drinks');
    const request = TestBed.inject(HttpTestingController).expectOne('/get-products-by-category');
    expect(request.request.body).toEqual({ category: 'Wine & Drinks' });
    request.flush({ success: true, products: [{ _id: 'p1', name: 'Juice', price: '10.50', category: 'Wine & Drinks', image: product.image }] });
    expect((await promise)[0]).toMatchObject(product);
  });
  it('sends search using the existing frontend field', async () => {
    const promise = TestBed.inject(ApiService).products('', ' Juice ');
    const request = TestBed.inject(HttpTestingController).expectOne('/find-product');
    expect(request.request.body).toEqual({ product: 'Juice' }); request.flush({ success: true, products: [] });
    expect(await promise).toEqual([]);
  });
  it('formats admin prices for the backend validator', async () => {
    const promise = TestBed.inject(ApiService).saveProduct(product);
    const request = TestBed.inject(HttpTestingController).expectOne('/edit-product');
    expect(request.request.body.price).toBe('10.50'); expect(request.request.body.id).toBe('p1');
    request.flush({ success: true }); expect((await promise).success).toBe(true);
  });
});

describe('authentication and guards', () => {
  it('logs in using existing API fields', async () => {
    const auth = TestBed.inject(AuthService); const promise = auth.login('buyer@example.com', 'password123');
    const request = TestBed.inject(HttpTestingController).expectOne('/login');
    expect(request.request.body).toEqual({ username: 'buyer@example.com', password: 'password123' });
    request.flush({ success: true, ...customer }); expect(await promise).toBe(true); expect(auth.user()).toEqual(customer);
  });
  it.each(['denied', 'network'])('reconnect handles %s', async outcome => {
    const auth = TestBed.inject(AuthService); const promise = auth.reconnect();
    const request = TestBed.inject(HttpTestingController).expectOne('/reconect');
    if (outcome === 'denied') request.flush({ success: false }); else request.flush('error', { status: 500, statusText: 'Error' });
    expect(await promise).toBeNull(); expect(auth.user()).toBeNull();
  });
  it('normalizes the reconnect name and shares concurrent requests', async () => {
    const auth = TestBed.inject(AuthService); const first = auth.reconnect(); const second = auth.reconnect();
    TestBed.inject(HttpTestingController).expectOne('/reconect').flush({ success: true, ...customer, name: { first_name: 'John', last_name: 'Smith' } });
    expect(await first).toEqual(customer); expect(await second).toEqual(customer);
  });
  it.each(['success', 'denied', 'network'])('logout handles %s', async outcome => {
    const auth = TestBed.inject(AuthService); auth.user.set(customer); const promise = auth.logout();
    const result = promise.then(() => 'ok', () => 'failed');
    const request = TestBed.inject(HttpTestingController).expectOne('/logout');
    if (outcome === 'network') request.flush('error', { status: 500, statusText: 'Error' }); else request.flush({ success: outcome === 'success' });
    expect(await result).toBe(outcome === 'success' ? 'ok' : 'failed'); expect(auth.user()).toEqual(outcome === 'success' ? null : customer);
  });
  for (const [path, allowed] of [['about', 0], ['info', 0], ['welcome', 0], ['store', 0], ['order/cart', 0], ['order/payment', 0], ['management', 1]] as const) {
    it(`allows only role ${allowed} for /${path}`, async () => {
      const auth = TestBed.inject(AuthService); const router = TestBed.inject(Router);
      const route = new ActivatedRouteSnapshot(); route.data = routes.find(route => route.path === path)!.data!;
      for (const role of [0, 1]) {
        auth.user.set({ ...customer, role });
        const result = await TestBed.runInInjectionContext(() => sessionGuard(route, {} as RouterStateSnapshot));
        expect(result === true ? true : router.serializeUrl(result as UrlTree)).toBe(role === allowed ? true : '/login');
      }
    });
  }
  it('redirects anonymous customers after a failed reconnect', async () => {
    const route = new ActivatedRouteSnapshot(); route.data = { role: 0 };
    const result = TestBed.runInInjectionContext(() => sessionGuard(route, {} as RouterStateSnapshot));
    TestBed.inject(HttpTestingController).expectOne('/reconect').flush({ success: false });
    expect(TestBed.inject(Router).serializeUrl(await result as UrlTree)).toBe('/login');
  });
});

describe('cart persistence', () => {
  it('uses server prices after creating and updating a cart', async () => {
    const cart = TestBed.inject(CartService); const http = TestBed.inject(HttpTestingController);
    const add = cart.add(product);
    http.expectOne('/create-cart').flush({ success: true, id: 'c1', products: [{ id: product.id, count: 1, price: 12 }] });
    await add; expect(cart.total()).toBe(12);
    const quantity = cart.quantity(product.id, 2);
    http.expectOne('/update-cart').flush({ success: true, products: [{ id: product.id, count: 2, price: 13 }] });
    await quantity; expect(cart.total()).toBe(26);
  });
  it('restores a server cart and computes its total', async () => {
    const cart = TestBed.inject(CartService); const promise = cart.load(); const http = TestBed.inject(HttpTestingController);
    http.expectOne('/get-cart').flush({ success: true, cart: { id: 'c1', products: [{ id: 'p1', count: 2, price: 10.5 }], created: '2026-01-01' } });
    http.expectOne('/get-all-products').flush({ success: true, products: [product] }); await promise;
    expect(cart.total()).toBe(21); expect(cart.lines()[0]?.name).toBe('Juice'); expect(cart.id()).toBe('c1');
  });
  it('creates a cart, updates quantities and removes items', async () => {
    const cart = TestBed.inject(CartService); const http = TestBed.inject(HttpTestingController);
    const add = cart.add(product); const create = http.expectOne('/create-cart');
    expect(create.request.body.products).toEqual([{ id: 'p1', count: 1, price: 10.5 }]);
    create.flush({ success: true, id: 'c1', date: '2026-01-01' }); await add;
    const quantity = cart.quantity('p1', 3); const update = http.expectOne('/update-cart');
    expect(update.request.body.id).toBe('c1'); update.flush({ success: true }); await quantity; expect(cart.total()).toBe(31.5);
    const remove = cart.remove('p1'); http.expectOne('/update-cart').flush({ success: true }); await remove; expect(cart.total()).toBe(0);
  });
  it('keeps the last saved cart when an update fails', async () => {
    const cart = TestBed.inject(CartService); cart.id.set('c1'); cart.items.set([{ id: 'p1', count: 1, price: 10.5 }]);
    const result = cart.quantity('p1', 2).catch(() => 'failed');
    TestBed.inject(HttpTestingController).expectOne('/update-cart').flush({ success: false });
    expect(await result).toBe('failed'); expect(cart.total()).toBe(10.5); expect(cart.busy()).toBe(false);
  });
  it.each([0, -1, 1.5, NaN])('rejects invalid quantity %s', async quantity => {
    await expect(TestBed.inject(CartService).quantity('p1', quantity)).rejects.toThrow('positive whole number');
  });
});

describe('Angular rendering and forms', () => {
  it('allows administrators to edit products with server-hosted image URLs', () => {
    const fixture = TestBed.createComponent(ManagementPage);
    fixture.componentInstance.edit({ ...product, image: '/products/apple-juice.png' });
    expect(fixture.componentInstance.form.valid).toBe(true);
    fixture.componentInstance.form.controls.image.setValue('/products/../../private.png');
    expect(fixture.componentInstance.form.controls.image.valid).toBe(false);
  });
  it('renders the login form and rejects invalid input before HTTP', async () => {
    const fixture = TestBed.createComponent(LoginPage); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Sign in');
    await fixture.componentInstance.submit(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('valid email');
    TestBed.inject(HttpTestingController).expectNone('/login');
  });
  it('renders both signup steps and submits the current API fields', async () => {
    const fixture = TestBed.createComponent(SignupPage); const page = fixture.componentInstance; fixture.detectChanges();
    page.account.setValue({ id: '123456789', email: 'buyer@example.com', pass: 'password123', confirm: 'password123' });
    page.next(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Step 2 of 2');
    page.details.setValue({ firstName: 'John', lastName: 'Smith', city: 'Tel Aviv', street: 'Ha Masger' });
    const promise = page.submit(); const request = TestBed.inject(HttpTestingController).expectOne('/sign-up');
    expect(request.request.body).not.toHaveProperty('confirm'); expect(request.request.body.id).toBe('123456789');
    request.flush({ created: true }); await promise; expect(TestBed.inject(Router).url).toBe('/login');
  });
  it('clears cart data after successful logout', async () => {
    const fixture = TestBed.createComponent(AppComponent); const auth = TestBed.inject(AuthService); const cart = TestBed.inject(CartService);
    auth.user.set(customer); cart.id.set('c1'); cart.items.set([{ id: 'p1', count: 1, price: 10.5 }]);
    const promise = fixture.componentInstance.logout(); TestBed.inject(HttpTestingController).expectOne('/logout').flush({ success: true });
    await promise; expect(cart.items()).toEqual([]); expect(cart.id()).toBeNull();
  });
  it.each([['/login', 'Login to Dragon shop'], ['/sign-up', 'Sign up to Dragon shop'], ['/about', 'About us'], ['/order/payment', 'Order']])(
    'sets the page title for %s', async (url, title) => {
      TestBed.inject(AuthService).user.set(customer); const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url); expect(TestBed.inject(Title).getTitle()).toBe(title);
      if (url === '/order/payment') {
        TestBed.inject(HttpTestingController).expectOne('/get-cart').flush({ success: true });
        TestBed.inject(HttpTestingController).expectOne('/get-all-products').flush({ success: true, products: [] });
      }
    },
  );
});

describe('demo checkout', () => {
  function setup() {
    const fixture = TestBed.createComponent(CheckoutPage); const page = fixture.componentInstance;
    page.loading.set(false); page.cart.id.set('c1'); page.cart.items.set([{ id: 'p1', count: 2, price: 10.5 }]);
    page.form.setValue({ city: 'Tel Aviv', street: 'Ha Masger 10', date: '2099-12-01', cardholder: 'John Smith', number: '4242 4242 4242 4242', expiry: '12/99', cvc: '123' });
    return page;
  }
  it('sends shipping and last four digits without card number, expiry or security code', async () => {
    const page = setup(); const pending = page.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/checkout');
    expect(request.request.body).toEqual({ cartId: 'c1', shipping: { city: 'Tel Aviv', street: 'Ha Masger 10', date: '2099-12-01' }, payment: { method: 'credit_card', last4: '4242' } });
    request.flush({ success: true, order: { id: 'o1', total: 21, shipping: request.request.body.shipping, payment: { mode: 'demo', last4: '4242' } } });
    await pending; expect(page.completed()?.id).toBe('o1'); expect(page.cart.items()).toEqual([]);
    expect(page.form.controls.number.value).toBe(''); expect(page.form.controls.cvc.value).toBe('');
  });
  it.each([{ date: '2000-01-01' }, { date: '2099-02-30' }, { number: '4111111111111111' }, { expiry: '00/99' }, { cvc: '12' }, { city: ' ' }])('rejects invalid fields (%j)', async invalid => {
    const page = setup(); page.form.patchValue(invalid); await page.submit();
    expect(page.error()).toBeTruthy(); TestBed.inject(HttpTestingController).expectNone('/checkout');
  });
  it('keeps the cart after failure and prevents double submissions', async () => {
    const page = setup(); const pending = page.submit(); await page.submit();
    TestBed.inject(HttpTestingController).expectOne('/checkout').flush({ success: false, reason: 'Cart changed' });
    await pending; expect(page.cart.id()).toBe('c1'); expect(page.error()).toBe('Cart changed'); expect(page.completed()).toBeNull();
  });
});
