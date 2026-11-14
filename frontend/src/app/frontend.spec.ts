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
import { ApiService, Product } from './api.service';
import { AuthService, sessionGuard } from './auth.service';
import { CartService } from './cart.service';
import { routes } from './app.routes';
import { AppComponent } from './app.component';
import { LoginPage, SignupPage } from './auth.pages';
import { ManagementPage } from './store.pages';
import { CheckoutPage } from './checkout.page';
import { CustomerWelcome } from './customer.pages';
import {
  emailPattern,
  namePattern,
  streetPattern,
  passwordsMatch,
  priceValidator,
} from './validators';

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
    request.flush({
      success: true,
      products: [
        {
          _id: 'p1',
          name: 'Juice',
          price: '10.50',
          category: 'Wine & Drinks',
          image: product.image,
        },
      ],
    });
    expect((await promise)[0]).toMatchObject(product);
  });
  it('sends search using the existing frontend field', async () => {
    const promise = TestBed.inject(ApiService).products('', ' Juice ');
    const request = TestBed.inject(HttpTestingController).expectOne('/find-product');
    expect(request.request.body).toEqual({ product: 'Juice' });
    request.flush({ success: true, products: [] });
    expect(await promise).toEqual([]);
  });
  it('formats admin prices for the backend validator', async () => {
    const promise = TestBed.inject(ApiService).saveProduct(product);
    const request = TestBed.inject(HttpTestingController).expectOne('/edit-product');
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
    const request = TestBed.inject(HttpTestingController).expectOne('/login');
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
      .expectOne('/login')
      .flush({ success: false }, { status, statusText: 'Error' });
    expect(await result).toBe(status === 401 ? false : 'error');
    expect(auth.user()).toBeNull();
  });
  it('clears local session after logout returns HTTP 401', async () => {
    const auth = TestBed.inject(AuthService);
    auth.user.set(customer);
    const pending = auth.logout();
    TestBed.inject(HttpTestingController)
      .expectOne('/logout')
      .flush({ success: false }, { status: 401, statusText: 'Unauthorized' });
    await pending;
    expect(auth.user()).toBeNull();
  });
  it.each(['denied', 'network'])('reconnect handles %s', async (outcome) => {
    const auth = TestBed.inject(AuthService);
    const promise = auth.reconnect();
    const request = TestBed.inject(HttpTestingController).expectOne('/reconect');
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
      .expectOne('/reconect')
      .flush({ success: true, ...customer, name: { first_name: 'John', last_name: 'Smith' } });
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
    const request = TestBed.inject(HttpTestingController).expectOne('/logout');
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
      .expectOne('/reconect')
      .flush({ success: false }, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(Router).serializeUrl((await result) as UrlTree)).toBe('/login');
  });
});

describe('cart persistence', () => {
  it('uses server prices after creating and updating a cart', async () => {
    const cart = TestBed.inject(CartService);
    const http = TestBed.inject(HttpTestingController);
    const add = cart.add(product);
    http
      .expectOne('/create-cart')
      .flush({ success: true, id: 'c1', products: [{ id: product.id, count: 1, price: 12 }] });
    await add;
    expect(cart.total()).toBe(12);
    const quantity = cart.quantity(product.id, 2);
    http
      .expectOne('/update-cart')
      .flush({ success: true, products: [{ id: product.id, count: 2, price: 13 }] });
    await quantity;
    expect(cart.total()).toBe(26);
  });
  it('restores a server cart and computes its total', async () => {
    const cart = TestBed.inject(CartService);
    const promise = cart.load();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/get-cart').flush({
      success: true,
      cart: { id: 'c1', products: [{ id: 'p1', count: 2, price: 10.5 }], created: '2026-01-01' },
    });
    http.expectOne('/get-all-products').flush({ success: true, products: [product] });
    await promise;
    expect(cart.total()).toBe(21);
    expect(cart.lines()[0]?.name).toBe('Juice');
    expect(cart.id()).toBe('c1');
  });
  it('creates a cart, updates quantities and removes items', async () => {
    const cart = TestBed.inject(CartService);
    const http = TestBed.inject(HttpTestingController);
    const add = cart.add(product);
    const create = http.expectOne('/create-cart');
    expect(create.request.body.products).toEqual([{ id: 'p1', count: 1, price: 10.5 }]);
    create.flush({ success: true, id: 'c1', date: '2026-01-01' });
    await add;
    const quantity = cart.quantity('p1', 3);
    const update = http.expectOne('/update-cart');
    expect(update.request.body.id).toBe('c1');
    update.flush({ success: true });
    await quantity;
    expect(cart.total()).toBe(31.5);
    const remove = cart.remove('p1');
    http.expectOne('/update-cart').flush({ success: true });
    await remove;
    expect(cart.total()).toBe(0);
  });
  it('keeps the last saved cart when an update fails', async () => {
    const cart = TestBed.inject(CartService);
    cart.id.set('c1');
    cart.items.set([{ id: 'p1', count: 1, price: 10.5 }]);
    const result = cart.quantity('p1', 2).catch(() => 'failed');
    TestBed.inject(HttpTestingController).expectOne('/update-cart').flush({ success: false });
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
  it('allows administrators to edit products with server-hosted image URLs', () => {
    const fixture = TestBed.createComponent(ManagementPage);
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
    TestBed.inject(HttpTestingController).expectNone('/login');
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
    page.next();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Step 2 of 2');
    page.details.setValue({
      firstName: 'John',
      lastName: 'Smith',
      city: 'Tel Aviv',
      street: 'Ha Masger',
    });
    const promise = page.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/sign-up');
    expect(request.request.body).not.toHaveProperty('confirm');
    expect(request.request.body.id).toBe('123456789');
    request.flush({ created: true });
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
    TestBed.inject(HttpTestingController).expectOne('/logout').flush({ success: true });
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
      TestBed.inject(HttpTestingController).expectOne('/get-last-order').flush({ success: true });
      TestBed.inject(HttpTestingController).expectOne('/get-cart').flush({ success: true });
      TestBed.inject(HttpTestingController)
        .expectOne('/get-all-products')
        .flush({ success: true, products: [] });
    }
    if (url === '/order/payment') {
      TestBed.inject(HttpTestingController).expectOne('/get-cart').flush({ success: true });
      TestBed.inject(HttpTestingController)
        .expectOne('/get-all-products')
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
      TestBed.inject(HttpTestingController).expectOne('/get-last-order').flush({ success: true });
      await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('h1').textContent).toBe(
        isReturning ? 'Welcome back to Dragon shop' : 'Welcome to your first buy in Dragon shop',
      );
    },
  );
  it.each([
    [{ success: true }, 'Welcome to your first buy in Dragon shop'],
    [{ success: true, order: { _id: 'o1' } }, 'Welcome back to Dragon shop'],
    [{ success: false }, 'Welcome to Dragon shop'],
  ])('uses customer order history (%j)', async (result, expected) => {
    const fixture = TestBed.createComponent(CustomerWelcome);
    vi.spyOn(fixture.componentInstance.cart, 'load').mockResolvedValue();
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/get-last-order').flush(result);
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe(expected);
  });
});

describe('welcome shopping summary', () => {
  const previousOrder = {
    _id: 'o1',
    price: 18,
    created_at: '2026-01-01T10:00:00Z',
    products: [{ id: 'p1', name: 'Original juice', count: 3, price: 6 }],
  };
  it.each(['full', 'empty', 'none'] as const)(
    'shows the open cart before order history (%s)',
    async (state) => {
      const fixture = TestBed.createComponent(CustomerWelcome);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/get-last-order').flush({ success: true, order: previousOrder });
      http.expectOne('/get-all-products').flush({ success: true, products: [product] });
      http.expectOne('/get-cart').flush({
        success: true,
        ...(state === 'none'
          ? {}
          : {
              cart: {
                id: 'c1',
                created: '2026-01-01T10:00:00Z',
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
    http.expectOne('/get-last-order').flush({ success: true });
    http.expectOne('/get-cart').flush({ success: true });
    http.expectOne('/get-all-products').flush({ success: true, products: [] });
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
    const request = TestBed.inject(HttpTestingController).expectOne('/checkout');
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
    const request = TestBed.inject(HttpTestingController).expectOne('/checkout');
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
      const request = TestBed.inject(HttpTestingController).expectOne('/checkout');
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
    TestBed.inject(HttpTestingController).expectNone('/checkout');
  });
  it('keeps the cart after failure and prevents double submissions', async () => {
    const page = setup();
    const pending = page.submit();
    await page.submit();
    TestBed.inject(HttpTestingController)
      .expectOne('/checkout')
      .flush({ success: false, reason: 'Cart changed' });
    await pending;
    expect(page.cart.id()).toBe('c1');
    expect(page.error()).toBe('Cart changed');
    expect(page.completed()).toBeNull();
  });
});
