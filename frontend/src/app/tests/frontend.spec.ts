import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiService } from '../services/api.service';
import { Product } from '../models/api.models';
import { AuthService } from '../services/auth.service';
import { sessionGuard } from '../guards/session.guard';
import { CartService } from '../services/cart.service';
import { routes } from '../routes/app.routes';
import { AppComponent } from '../components/app/app.component';
import { LoginPage } from '../pages/login/login.page';
import { SignupPage } from '../pages/signup/signup.page';
import { ProductEditorComponent } from '../components/product-editor/product-editor.component';
import { OrderPage } from '../pages/order/order.page';
import { CheckoutPage } from '../pages/checkout/checkout.page';
import { CustomerWelcome } from '../components/customer-welcome/customer-welcome.component';
import {
  emailPattern,
  namePattern,
  streetPattern,
  passwordsMatch,
  priceValidator,
} from '../validators/validators';

const customer = { user: 'u1', name: 'John Smith', role: 0 };
const product: Product = {
  id: 'p1',
  name: 'Juice',
  price: 10.5,
  category: 'Wine & Drinks',
  image: 'https://example.com/juice.png',
};
beforeEach(() =>
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
  }),
);
afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('form validation', () => {
  it.each(["O'Connor", 'Anne-Marie', 'D’Arcy', 'יוסף', '李', 'Jose\u0301', 'jean', 'תל אביב'])(
    'accepts name or city %s',
    (value) => {
      expect(new FormControl(value, Validators.pattern(namePattern)).valid).toBe(true);
    },
  );
  it.each([' ', '123', '<script>', 'John\nSmith', 'A'.repeat(151)])('rejects name %s', (value) => {
    expect(new FormControl(value, Validators.pattern(namePattern)).valid).toBe(false);
  });
  it.each(["12 O'Connell St., #4/2", 'דרך בן-גוריון 10', 'شارع النيل ٢', '北京市东路8号'])(
    'accepts street %s',
    (value) => {
      expect(new FormControl(value, Validators.pattern(streetPattern)).valid).toBe(true);
    },
  );
  it.each([' ', '---', '<script>', 'Main\nStreet', 'A'.repeat(151)])(
    'rejects street %s',
    (value) => {
      expect(new FormControl(value, Validators.pattern(streetPattern)).valid).toBe(false);
    },
  );
  it.each(['0.00', '10.99'])('accepts price %s', (value) =>
    expect(new FormControl(value, priceValidator).valid).toBe(true),
  );
  it.each(['', '10', '1.1', '-1.00', 'abc'])('rejects price %s', (value) =>
    expect(new FormControl(value, priceValidator).valid).toBe(false),
  );
  it.each(['j.smith@example.com', 'user123@test.co.il'])('accepts email %s', (value) =>
    expect(new FormControl(value, Validators.pattern(emailPattern)).valid).toBe(true),
  );
  it.each(['user', 'user@', '@example.com', 'a b@example.com'])('rejects email %s', (value) =>
    expect(new FormControl(value, Validators.pattern(emailPattern)).valid).toBe(false),
  );
  it('checks confirmation against the current password', () => {
    const form = new FormGroup(
      { pass: new FormControl('password123'), confirm: new FormControl('password123') },
      passwordsMatch,
    );
    expect(form.valid).toBe(true);
    form.controls.pass.setValue('updated');
    expect(form.valid).toBe(false);
    form.controls.confirm.setValue('updated');
    expect(form.valid).toBe(true);
  });
});

describe('API compatibility', () => {
  it.each([true, false])(
    'refreshes a rejected signup token and retries only once (success=%s)',
    async (success) => {
      const http = TestBed.inject(HttpTestingController);
      const body = {
        id: '123456789',
        email: 'buyer@example.com',
        pass: 'password123',
        firstName: 'John',
        lastName: 'Smith',
        city: 'Haifa',
        street: 'Main 1',
      };
      document.cookie = 'XSRF-TOKEN=stale; path=/';
      try {
        const pending = TestBed.inject(ApiService).signup(body);
        const outcome = pending.then(
          (value) => value,
          (error) => error,
        );
        http
          .expectOne('/api/auth/signup')
          .flush(
            { reason: 'Invalid CSRF token or request origin.' },
            { status: 403, statusText: 'Forbidden' },
          );
        await Promise.resolve();
        document.cookie = 'XSRF-TOKEN=fresh; path=/';
        http.expectOne('/api/auth/csrf-token').flush({ success: true });
        await Promise.resolve();
        const retry = http.expectOne('/api/auth/signup');
        expect(retry.request.body).toEqual(body);
        expect(retry.request.headers.get('X-XSRF-TOKEN')).toBe('fresh');
        if (success) {
          retry.flush({ success: true });
          expect(await outcome).toEqual({ success: true });
        } else {
          retry.flush(
            { reason: 'Invalid CSRF token or request origin.' },
            { status: 403, statusText: 'Forbidden' },
          );
          expect(await outcome).toMatchObject({ status: 403 });
        }
        http.expectNone('/api/auth/csrf-token');
      } finally {
        document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
      }
    },
  );
  it('sends the CSRF cookie as a header on same-origin writes', async () => {
    document.cookie = 'XSRF-TOKEN=test-signed-token; path=/';
    try {
      const pending = TestBed.inject(ApiService).logout();
      const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/logout');
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('test-signed-token');
      request.flush({ success: true });
      await pending;
    } finally {
      document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
    }
  });
  it('uploads an image as multipart form data', async () => {
    const file = new File(['image'], 'cheese.png', { type: 'image/png' });
    const promise = TestBed.inject(ApiService).uploadProductImage(file);
    const request = TestBed.inject(HttpTestingController).expectOne('/api/products/images');
    expect(request.request.body.get('image')).toBe(file);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({ success: true, image: '/products/test.png' });
    expect((await promise).image).toBe('/products/test.png');
  });
  it('returns the catalog product shape for category results', async () => {
    const promise = TestBed.inject(ApiService).products('Wine & Drinks');
    const request = TestBed.inject(HttpTestingController).expectOne('/api/products/by-category');
    expect(request.request.body).toEqual({ category: 'Wine & Drinks' });
    request.flush({
      success: true,
      products: [product],
    });
    expect((await promise)[0]).toMatchObject(product);
  });
  it('sends search using the existing frontend field', async () => {
    const promise = TestBed.inject(ApiService).products('', ' Juice ');
    const request = TestBed.inject(HttpTestingController).expectOne('/api/products/search');
    expect(request.request.body).toEqual({ product: 'Juice' });
    request.flush({ success: true, products: [] });
    expect(await promise).toEqual([]);
  });
  it('formats admin prices for the backend validator', async () => {
    const promise = TestBed.inject(ApiService).saveProduct(product);
    const request = TestBed.inject(HttpTestingController).expectOne('/api/products/update');
    expect(request.request.body.price).toBe('10.50');
    expect(request.request.body.id).toBe('p1');
    request.flush({ success: true });
    expect((await promise).success).toBe(true);
  });
});

describe('authentication and guards', () => {
  it('logs in using existing API fields', async () => {
    const auth = TestBed.inject(AuthService);
    const promise = auth.login('buyer@example.com', 'password123');
    const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/login');
    expect(request.request.body).toEqual({
      username: 'buyer@example.com',
      password: 'password123',
    });
    request.flush({ success: true, ...customer });
    expect(await promise).toBe(true);
    expect(auth.user()).toEqual(customer);
  });
  it.each([401, 403, 500])('login handles HTTP %s', async (status) => {
    const auth = TestBed.inject(AuthService);
    const pending = auth.login('buyer@example.com', 'password123');
    const result = pending.then(
      (value) => value,
      () => 'error',
    );
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/login')
      .flush({ success: false }, { status, statusText: 'Error' });
    expect(await result).toBe(status === 401 ? false : 'error');
    expect(auth.user()).toBeNull();
  });
  it('clears local session after logout returns HTTP 401', async () => {
    const auth = TestBed.inject(AuthService);
    auth.user.set(customer);
    const pending = auth.logout();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/logout')
      .flush({ success: false }, { status: 401, statusText: 'Unauthorized' });
    await pending;
    expect(auth.user()).toBeNull();
  });
  it.each(['denied', 'network'])('reconnect handles %s', async (outcome) => {
    const auth = TestBed.inject(AuthService);
    const promise = auth.reconnect();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/session');
    if (outcome === 'denied') {
      request.flush({ success: false }, { status: 401, statusText: 'Unauthorized' });
    } else {
      request.flush('error', { status: 500, statusText: 'Error' });
    }
    expect(await promise).toBeNull();
    expect(auth.user()).toBeNull();
  });
  it('normalizes the reconnect name and shares concurrent requests', async () => {
    const auth = TestBed.inject(AuthService);
    const first = auth.reconnect();
    const second = auth.reconnect();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/session')
      .flush({ success: true, ...customer, name: 'John Smith' });
    expect(await first).toEqual(customer);
    expect(await second).toEqual(customer);
  });
  it.each(['success', 'denied', 'network'])('logout handles %s', async (outcome) => {
    const auth = TestBed.inject(AuthService);
    auth.user.set(customer);
    const promise = auth.logout();
    const result = promise.then(
      () => 'ok',
      () => 'failed',
    );
    const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/logout');
    if (outcome === 'network') {
      request.flush('error', { status: 500, statusText: 'Error' });
    } else {
      request.flush({ success: outcome === 'success' });
    }
    expect(await result).toBe(outcome === 'success' ? 'ok' : 'failed');
    expect(auth.user()).toEqual(outcome === 'success' ? null : customer);
  });
  for (const [path, allowed] of [
    ['about', 0],
    ['info', 0],
    ['welcome', 0],
    ['store', 0],
    ['order/cart', 0],
    ['order/payment', 0],
    ['management', 1],
  ] as const) {
    it(`allows only role ${allowed} for /${path}`, async () => {
      const auth = TestBed.inject(AuthService);
      const router = TestBed.inject(Router);
      const route = new ActivatedRouteSnapshot();
      route.data = routes.find((route) => route.path === path)!.data!;
      for (const role of [0, 1]) {
        auth.user.set({ ...customer, role });
        const result = await TestBed.runInInjectionContext(() =>
          sessionGuard(route, {} as RouterStateSnapshot),
        );
        expect(result === true ? true : router.serializeUrl(result as UrlTree)).toBe(
          role === allowed ? true : '/login',
        );
      }
    });
  }
  it('redirects anonymous customers after a failed reconnect', async () => {
    const route = new ActivatedRouteSnapshot();
    route.data = { role: 0 };
    const result = TestBed.runInInjectionContext(() =>
      sessionGuard(route, {} as RouterStateSnapshot),
    );
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/session')
      .flush({ success: false }, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(Router).serializeUrl((await result) as UrlTree)).toBe('/login');
  });
});

describe('cart persistence', () => {
  it('uses server prices after creating and updating a cart', async () => {
    const cart = TestBed.inject(CartService);
    const http = TestBed.inject(HttpTestingController);
    const add = cart.add(product);
    http.expectOne('/api/carts').flush({
      success: true,
      cart: {
        id: 'c1',
        createdAt: '2026-01-01',
        products: [{ id: product.id, count: 1, price: 12 }],
      },
    });
    await add;
    expect(cart.total()).toBe(12);
    const quantity = cart.quantity(product.id, 2);
    http.expectOne('/api/carts/update').flush({
      success: true,
      cart: {
        id: 'c1',
        createdAt: '2026-01-01',
        products: [{ id: product.id, count: 2, price: 13 }],
      },
    });
    await quantity;
    expect(cart.total()).toBe(26);
  });
  it('restores a server cart and computes its total', async () => {
    const cart = TestBed.inject(CartService);
    const promise = cart.load();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/carts/current').flush({
      success: true,
      cart: { id: 'c1', products: [{ id: 'p1', count: 2, price: 10.5 }], createdAt: '2026-01-01' },
    });
    http.expectOne('/api/products').flush({ success: true, products: [product] });
    await promise;
    expect(cart.total()).toBe(21);
    expect(cart.lines()[0]?.name).toBe('Juice');
    expect(cart.id()).toBe('c1');
  });
  it('creates a cart, updates quantities and removes items', async () => {
    const cart = TestBed.inject(CartService);
    const http = TestBed.inject(HttpTestingController);
    const add = cart.add(product);
    const create = http.expectOne('/api/carts');
    expect(create.request.body.products).toEqual([{ id: 'p1', count: 1, price: 10.5 }]);
    create.flush({
      success: true,
      cart: { id: 'c1', createdAt: '2026-01-01', products: create.request.body.products },
    });
    await add;
    const quantity = cart.quantity('p1', 3);
    const update = http.expectOne('/api/carts/update');
    expect(update.request.body.id).toBe('c1');
    update.flush({
      success: true,
      cart: { id: 'c1', createdAt: '2026-01-01', products: update.request.body.products },
    });
    await quantity;
    expect(cart.total()).toBe(31.5);
    const remove = cart.remove('p1');
    http.expectOne('/api/carts/update').flush({
      success: true,
      cart: { id: 'c1', createdAt: '2026-01-01', products: [] },
    });
    await remove;
    expect(cart.total()).toBe(0);
  });
  it('keeps the last saved cart when an update fails', async () => {
    const cart = TestBed.inject(CartService);
    cart.id.set('c1');
    cart.items.set([{ id: 'p1', count: 1, price: 10.5 }]);
    const result = cart.quantity('p1', 2).catch(() => 'failed');
    TestBed.inject(HttpTestingController).expectOne('/api/carts/update').flush({ success: false });
    expect(await result).toBe('failed');
    expect(cart.total()).toBe(10.5);
    expect(cart.busy()).toBe(false);
  });
  it.each([0, -1, 1.5, NaN])('rejects invalid quantity %s', async (quantity) => {
    await expect(TestBed.inject(CartService).quantity('p1', quantity)).rejects.toThrow(
      'positive whole number',
    );
  });
});

describe('Angular rendering and forms', () => {
  it.each([
    [429, 'Too many signup attempts. Try again in 2 minute(s).'],
    [503, 'Signup is temporarily unavailable. Please try again shortly.'],
    [500, 'Unable to create your account. Please try again.'],
  ])('shows an actionable signup error for HTTP %s', async (status, reason) => {
    const fixture = TestBed.createComponent(SignupPage);
    const page = fixture.componentInstance;
    page.account.setValue({
      id: '123456789',
      email: 'buyer@example.com',
      pass: 'password123',
      confirm: 'password123',
    });
    page.details.setValue({
      firstName: 'John',
      lastName: 'Smith',
      city: 'Haifa',
      street: 'Main 1',
    });
    const pending = page.submit();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/signup')
      .flush(
        { reason: 'Request rejected' },
        { status: Number(status), statusText: 'Error', headers: { 'Retry-After': '90' } },
      );
    await pending;
    expect(page.error()).toBe(reason);
    expect(page.busy()).toBe(false);
  });
  it('allows administrators to edit products with server-hosted image URLs', () => {
    const fixture = TestBed.createComponent(ProductEditorComponent);
    fixture.componentInstance.edit({ ...product, image: '/products/apple-juice.png' });
    expect(fixture.componentInstance.form.valid).toBe(true);
    fixture.componentInstance.form.controls.image.setValue('/products/../../private.png');
    expect(fixture.componentInstance.form.controls.image.valid).toBe(false);
  });
  it('renders the login form and rejects invalid input before HTTP', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Sign in');
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'valid email',
    );
    TestBed.inject(HttpTestingController).expectNone('/api/auth/login');
  });
  it('renders both signup steps and submits the current API fields', async () => {
    const fixture = TestBed.createComponent(SignupPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.account.setValue({
      id: '123456789',
      email: 'buyer@example.com',
      pass: 'password123',
      confirm: 'password123',
    });
    const checking = page.next();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/signup/availability')
      .flush({ success: true, available: true });
    await checking;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Step 2 of 2');
    page.details.setValue({
      firstName: 'John',
      lastName: 'Smith',
      city: 'Tel Aviv',
      street: 'Ha Masger',
    });
    const promise = page.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/signup');
    expect(request.request.body).not.toHaveProperty('confirm');
    expect(request.request.body.id).toBe('123456789');
    request.flush({ success: true });
    await promise;
    expect(TestBed.inject(Router).url).toBe('/login');
  });
  it('clears cart data after successful logout', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const auth = TestBed.inject(AuthService);
    const cart = TestBed.inject(CartService);
    auth.user.set(customer);
    cart.id.set('c1');
    cart.items.set([{ id: 'p1', count: 1, price: 10.5 }]);
    const promise = fixture.componentInstance.logout();
    TestBed.inject(HttpTestingController).expectOne('/api/auth/logout').flush({ success: true });
    await promise;
    expect(cart.items()).toEqual([]);
    expect(cart.id()).toBeNull();
  });
  it.each([
    ['/login', 'Login to Dragon shop'],
    ['/sign-up', 'Sign up to Dragon shop'],
    ['/about', 'About us'],
    ['/order/payment', 'Order'],
  ])('sets the page title for %s', async (url, title) => {
    TestBed.inject(AuthService).user.set(customer);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    expect(TestBed.inject(Title).getTitle()).toBe(title);
    if (url === '/about') {
      TestBed.inject(HttpTestingController)
        .expectOne('/api/orders/latest')
        .flush({ success: true });
      TestBed.inject(HttpTestingController)
        .expectOne('/api/carts/current')
        .flush({ success: true });
      TestBed.inject(HttpTestingController)
        .expectOne('/api/products')
        .flush({ success: true, products: [] });
    }
    if (url === '/order/payment') {
      TestBed.inject(HttpTestingController)
        .expectOne('/api/carts/current')
        .flush({ success: true });
      TestBed.inject(HttpTestingController)
        .expectOne('/api/products')
        .flush({ success: true, products: [] });
    }
  });
});

describe('customer welcome heading', () => {
  it.each([false, true])(
    'uses login history even when the customer has no orders (%s)',
    async (isReturning) => {
      TestBed.inject(AuthService).user.set({ ...customer, isReturning });
      const fixture = TestBed.createComponent(CustomerWelcome);
      vi.spyOn(fixture.componentInstance.cart, 'load').mockResolvedValue();
      fixture.detectChanges();
      TestBed.inject(HttpTestingController)
        .expectOne('/api/orders/latest')
        .flush({ success: true });
      await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('h1').textContent).toBe(
        isReturning ? 'Welcome back to Dragon shop' : 'Welcome to your first buy in Dragon shop',
      );
    },
  );
  it.each([
    [{ success: true }, 'Welcome to your first buy in Dragon shop'],
    [{ success: true, order: { id: 'o1' } }, 'Welcome back to Dragon shop'],
    [{ success: false }, 'Welcome to Dragon shop'],
  ])('uses customer order history (%j)', async (result, expected) => {
    const fixture = TestBed.createComponent(CustomerWelcome);
    vi.spyOn(fixture.componentInstance.cart, 'load').mockResolvedValue();
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/orders/latest').flush(result);
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe(expected);
  });
});

describe('welcome shopping summary', () => {
  const previousOrder = {
    id: 'o1',
    total: 18,
    createdAt: '2026-01-01T10:00:00Z',
    products: [{ id: 'p1', name: 'Original juice', count: 3, price: 6 }],
  };
  it.each(['full', 'empty', 'none'] as const)(
    'shows the open cart before order history (%s)',
    async (state) => {
      const fixture = TestBed.createComponent(CustomerWelcome);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/orders/latest').flush({ success: true, order: previousOrder });
      http.expectOne('/api/products').flush({ success: true, products: [product] });
      http.expectOne('/api/carts/current').flush({
        success: true,
        ...(state === 'none'
          ? {}
          : {
              cart: {
                id: 'c1',
                createdAt: '2026-01-01T10:00:00Z',
                products: state === 'full' ? [{ id: 'p1', count: 2, price: 10.5 }] : [],
              },
            }),
      });
      await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      if (state === 'none') {
        expect(text).toContain('Your latest order');
        expect(text).toContain('Original juice');
        expect(text).toContain('$18.00');
        expect(text).not.toContain('Your open cart');
        expect(fixture.nativeElement.querySelector('a').textContent).toBe('Start shopping');
      } else {
        expect(text).toContain('Your open cart');
        expect(text).toContain('Created at');
        expect(text).toContain('Jan 1, 2026');
        expect(text).not.toContain('Last updated');
        expect(text).not.toContain('Your latest order');
        expect(fixture.nativeElement.querySelector('a').textContent).toBe('Continue shopping');
        expect(text).toContain(state === 'full' ? '$21.00' : 'Your cart is empty.');
      }
    },
  );
  it('offers Start shopping when no cart or previous order exists', async () => {
    const fixture = TestBed.createComponent(CustomerWelcome);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/orders/latest').flush({ success: true });
    http.expectOne('/api/carts/current').flush({ success: true });
    http.expectOne('/api/products').flush({ success: true, products: [] });
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Welcome to your first buy in Dragon shop');
    expect(fixture.nativeElement.querySelector('a').textContent).toBe('Start shopping');
  });
});

describe('demo checkout', () => {
  it.each([
    { city: 'Saint-Étienne', street: '12 O’Connell St., #4/2', cardholder: "Anne-Marie O'Connor" },
    { city: 'תל אביב', street: 'דרך בן-גוריון 10', cardholder: 'יוסף כהן' },
    { city: '北京', street: '北京市东路8号', cardholder: '李王' },
  ])('submits international shipping and cardholder details (%j)', async (details) => {
    const page = setup();
    page.form.patchValue(details);
    expect(page.form.valid).toBe(true);
    const pending = page.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/orders/checkout');
    expect(request.request.body.shipping).toEqual({
      city: details.city,
      street: details.street,
      date: '2099-12-01',
    });
    expect(request.request.body.payment).toEqual({ method: 'credit_card', last4: '4242' });
    request.flush({ success: false, reason: 'Test response' });
    await pending;
  });
  it('fills empty profile fields on double click and preserves entered values', async () => {
    TestBed.inject(AuthService).user.set({
      ...customer,
      name: 'John Smith',
      address: { city: 'Tel Aviv', street: 'Ha Masger 10' },
    });
    const fixture = TestBed.createComponent(CheckoutPage);
    const page = fixture.componentInstance;
    vi.spyOn(page.cart, 'load').mockResolvedValue();
    page.cart.items.set([{ id: 'p1', count: 1, price: 10.5 }]);
    await page.ngOnInit();
    fixture.detectChanges();
    fixture.detectChanges();
    for (const index of [0, 1, 3]) {
      fixture.nativeElement
        .querySelectorAll('input')
        [index].dispatchEvent(new MouseEvent('dblclick'));
    }
    expect(page.form.getRawValue()).toMatchObject({
      city: 'Tel Aviv',
      street: 'Ha Masger 10',
      cardholder: 'John Smith',
      number: '',
      expiry: '',
      cvc: '',
      date: '',
    });
    page.form.controls.city.setValue('Haifa');
    page.autofill('city');
    expect(page.form.controls.city.value).toBe('Haifa');
    page.form.controls.street.setValue('');
    TestBed.inject(AuthService).user.set({ ...customer, address: {} });
    page.autofill('street');
    expect(page.form.controls.street.value).toBe('');
    page.form.controls.city.setValue('');
    page.saving.set(true);
    page.autofill('city');
    expect(page.form.controls.city.value).toBe('');
  });
  function setup(fixture = TestBed.createComponent(CheckoutPage)) {
    const page = fixture.componentInstance;
    page.loading.set(false);
    page.cart.id.set('c1');
    page.cart.items.set([{ id: 'p1', count: 2, price: 10.5 }]);
    page.form.setValue({
      city: 'Tel Aviv',
      street: 'Ha Masger 10',
      date: '2099-12-01',
      cardholder: 'John Smith',
      number: '4242 4242 4242 4242',
      expiry: '12/99',
      cvc: '123',
    });
    return page;
  }
  it('sends shipping and last four digits without card number, expiry or security code', async () => {
    const fixture = TestBed.createComponent(CheckoutPage);
    const page = setup(fixture);
    vi.spyOn(page.cart, 'load').mockResolvedValue();
    const pending = page.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/orders/checkout');
    expect(request.request.body).toEqual({
      cartId: 'c1',
      shipping: { city: 'Tel Aviv', street: 'Ha Masger 10', date: '2099-12-01' },
      payment: { method: 'credit_card', last4: '4242' },
    });
    request.flush({
      success: true,
      order: {
        id: 'o1',
        total: 21,
        invoiceUrl: '/orders/o1/invoice',
        shipping: request.request.body.shipping,
        payment: { mode: 'demo', last4: '4242' },
      },
    });
    await pending;
    expect(page.completed()?.id).toBe('o1');
    expect(page.cart.items()).toEqual([]);
    expect(page.form.controls.number.value).toBe('');
    expect(page.form.controls.cvc.value).toBe('');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your order success!');
    expect(fixture.nativeElement.textContent).not.toContain('THE LAST LITTLE DETAILS');
    expect(fixture.nativeElement.textContent).not.toContain('Demo order confirmed');
    const link = fixture.nativeElement.querySelector('a');
    expect(link.textContent).toBe('here');
    expect(link.getAttribute('href')).toBe('/orders/o1/invoice');
    expect(link.getAttribute('download')).toBe('invoice-o1.pdf');
    fixture.destroy();
  });
  it.each(['5800  5800 5800 5800', '5800580058005800', '4111111111111111'])(
    'accepts card number %s and sends only its last four digits',
    async (number) => {
      const page = setup();
      page.form.controls.number.setValue(number);
      const pending = page.submit();
      const request = TestBed.inject(HttpTestingController).expectOne('/api/orders/checkout');
      expect(request.request.body.payment).toEqual({
        method: 'credit_card',
        last4: number.replace(/ /g, '').slice(-4),
      });
      request.flush({ success: false, reason: 'Test response' });
      await pending;
    },
  );
  it.each([
    { date: '2000-01-01' },
    { date: '2099-02-30' },
    { number: '58005800' },
    { number: '5800 5800 abcd 5800' },
    { expiry: '00/99' },
    { cvc: '12' },
    { city: ' ' },
  ])('rejects invalid fields (%j)', async (invalid) => {
    const page = setup();
    page.form.patchValue(invalid);
    await page.submit();
    expect(page.error()).toBeTruthy();
    TestBed.inject(HttpTestingController).expectNone('/api/orders/checkout');
  });
  it('keeps the cart after failure and prevents double submissions', async () => {
    const page = setup();
    const pending = page.submit();
    await page.submit();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/orders/checkout')
      .flush({ success: false, reason: 'Cart changed' });
    await pending;
    expect(page.cart.id()).toBe('c1');
    expect(page.error()).toBe('Cart changed');
    expect(page.completed()).toBeNull();
  });
});

describe('signup account availability', () => {
  function setup() {
    const fixture = TestBed.createComponent(SignupPage);
    fixture.componentInstance.account.setValue({
      id: '123456789',
      email: 'buyer@example.com',
      pass: 'password123',
      confirm: 'password123',
    });
    return fixture;
  }
  it.each([
    [true, false, 'This email is already registered.'],
    [false, true, 'This ID number is already registered.'],
    [true, true, 'This email and ID number are already registered.'],
  ])(
    'stays on the account step for existing credentials (%s, %s)',
    async (emailExists, idExists, reason) => {
      const fixture = setup();
      const page = fixture.componentInstance;
      fixture.detectChanges();
      const pending = page.next();
      await page.next();
      expect(page.busy()).toBe(true);
      const request = TestBed.inject(HttpTestingController).expectOne(
        '/api/auth/signup/availability',
      );
      expect(request.request.body).toEqual({ email: 'buyer@example.com', id: '123456789' });
      request.flush({ success: true, available: false, emailExists, idExists, reason });
      await pending;
      fixture.detectChanges();
      expect(page.step()).toBe(1);
      expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(reason);
      expect(page.busy()).toBe(false);
      TestBed.inject(HttpTestingController).expectNone('/api/auth/signup');
    },
  );
  it('stays on the first step when checking fails and allows retrying', async () => {
    const page = setup().componentInstance;
    const pending = page.next();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/signup/availability')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await pending;
    expect(page.step()).toBe(1);
    expect(page.busy()).toBe(false);
    expect(page.error()).toContain('temporarily unavailable');
    const retry = page.next();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/signup/availability')
      .flush({ success: true, available: true });
    await retry;
    expect(page.step()).toBe(2);
  });
  it('does not advance with a response for changed credentials', async () => {
    const page = setup().componentInstance;
    const pending = page.next();
    page.account.controls.email.setValue('changed@example.com');
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/signup/availability')
      .flush({ success: true, available: true });
    await pending;
    expect(page.step()).toBe(1);
    expect(page.error()).toContain('details changed');
  });
});

describe('order review search', () => {
  it('highlights whole matching product names while keeping every row and the full total', async () => {
    const fixture = TestBed.createComponent(OrderPage);
    const page = fixture.componentInstance;
    vi.spyOn(page.cart, 'load').mockResolvedValue();
    page.cart.catalog.set([product, { ...product, id: 'p2', name: 'Milk', price: 4 }]);
    page.cart.items.set([
      { id: 'p1', count: 2, price: 10.5 },
      { id: 'p2', count: 1, price: 4 },
    ]);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=search]');
    for (const [query, names] of [
      ['  jUiCe  ', ['Juice']],
      ['i', ['Juice', 'Milk']],
      ['.', []],
      ['missing', []],
      ['', []],
    ] as const) {
      input.value = query;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(
        Array.from(fixture.nativeElement.querySelectorAll('mark'), (mark: any) => mark.textContent),
      ).toEqual(names);
      expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
      expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('Milk');
      expect(page.cart.total()).toBe(25);
      expect(page.cart.items()).toHaveLength(2);
      expect(fixture.nativeElement.querySelector('a.button').textContent).toContain(
        'Continue to checkout',
      );
    }
  });
});
