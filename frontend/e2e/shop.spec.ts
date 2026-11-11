import { expect, test } from '@playwright/test';
import path from 'node:path';

test('administrator can upload a product image and retain it when editing', async ({ page }) => {
  let uploadCount = 0;
  let product = { id: 'p1', name: 'Edam', category: 'Milk & Eggs', price: 5.25, image: '/products/edam.png' };
  await page.route('**/reconect', route => route.fulfill({ json: { success: true, role: 1, user: 'admin', name: 'Shop Admin' } }));
  await page.route('**/get-all-products', route => route.fulfill({ json: { success: true, products: [product] } }));
  await page.route('**/upload-product-image', async route => {
    uploadCount++;
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    expect(route.request().postDataBuffer()?.includes(Buffer.from('filename="edam.png"'))).toBe(true);
    await route.fulfill({ json: { success: true, image: '/products/uploads/new.png' } });
  });
  for (const endpoint of ['add-product', 'edit-product']) {
    await page.route(`**/${endpoint}`, async route => {
      const body = route.request().postDataJSON();
      expect(body.image).toBe('/products/uploads/new.png');
      product = { ...product, ...body, price: Number(body.price) };
      await route.fulfill({ json: { success: true } });
    });
  }
  await page.goto('/#/management');
  await page.getByLabel('Product name').fill('New cheese');
  await page.getByLabel('Price', { exact: true }).fill('5.25');
  await page.getByLabel('Product image', { exact: true }).setInputFiles(path.resolve(__dirname, '../../backend/static/products/edam.png'));
  await expect(page.getByAltText('Product image preview')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('.image-upload-control')).toContainText('edam.png');
  await expect(page.locator('.image-upload-control img')).toBeVisible();
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByText('Product saved.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit New cheese' }).click();
  await expect(page.getByLabel('Product image', { exact: true })).toHaveValue('');
  await page.getByLabel('Price', { exact: true }).fill('6.00');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByText('Product saved.', { exact: true })).toBeVisible();
  expect(uploadCount).toBe(1);
});

// Serve real compiled Angular pages; mock customer API data to avoid changing the database.
test('customer can shop, change quantities, reload, review, and sign out', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const product = { id: 'p1', name: 'Apple Juice', category: 'Wine & Drinks', price: 10.5, image: '/assets/img/logo.png' };
  let cart: { id: string; count: number; price: number }[] = []; let exists = false;
  for (const path of ['reconect', 'get-all-products', 'get-products-by-category', 'find-product', 'get-cart', 'create-cart', 'update-cart', 'logout']) {
    await page.route(`**/${path}`, async route => {
      const body = route.request().postDataJSON();
      let result: object = { success: true };
      if (path === 'reconect') result = { success: true, role: 0, user: 'u1', name: { first_name: 'John', last_name: 'Smith' } };
      if (['get-all-products', 'get-products-by-category', 'find-product'].includes(path)) result = { success: true, products: [product] };
      if (path === 'get-cart') result = { success: true, ...(exists ? { cart: { id: 'c1', products: cart, created: '2026-01-01' } } : {}) };
      if (path === 'create-cart' || path === 'update-cart') { cart = body.products; exists = true; result = { success: true, id: 'c1', date: '2026-01-01' }; }
      await route.fulfill({ json: result });
    });
  }
  await page.goto('/#/store');
  await expect(page.getByRole('heading', { name: 'Store', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Wine & Drinks', exact: true }).click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  const quantity = page.getByRole('spinbutton', { name: 'Quantity' });
  await expect(quantity).toHaveValue('1');
  await quantity.fill('3');
  await expect(page.locator('.total')).toContainText('$31.50');
  await page.reload(); await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('3');
  await page.getByRole('link', { name: 'Review order' }).click();
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
  await expect(page.locator('table')).toContainText('Apple Juice');
  await page.getByRole('link', { name: 'Continue to checkout' }).click();
  await expect(page.getByText('Online checkout is not available yet. Your shopping cart is saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('two-step signup validates confirmation and submits the existing API payload', async ({ page }) => {
  await page.route('**/sign-up', route => route.fulfill({ json: { created: true } }));
  await page.goto('/#/sign-up');
  await page.getByLabel('ID number').fill('123456789'); await page.getByLabel('Email', { exact: true }).fill('test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123'); await page.getByLabel('Confirm password').fill('different');
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Confirm password').fill('password123'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('First name').fill('John'); await page.getByLabel('Last name').fill('Smith');
  await page.getByLabel('City').selectOption('Tel Aviv'); await page.getByLabel('Street').fill('Ha Masger');
  const submitted = page.waitForRequest(request => request.url().endsWith('/sign-up') && request.method() === 'POST');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  expect((await submitted).postDataJSON()).toEqual({ id: '123456789', email: 'test@example.com', pass: 'password123', firstName: 'John', lastName: 'Smith', city: 'Tel Aviv', street: 'Ha Masger' });
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('live demo administrator can sign in, search products, reconnect and sign out', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/login'); await page.getByLabel('Email', { exact: true }).fill('j.smith@example.com');
  await page.getByLabel('Password', { exact: true }).fill('sec907@Ad0');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Product manager' })).toBeVisible();
  await expect(page.locator('.product').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('management.png'), fullPage: true });
  await page.getByLabel('Find a product').fill('apple'); await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.product').first()).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Product manager' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('redesigned login and storefront fit desktop and mobile screens', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/login');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.locator('header .brand-mark')).toHaveAttribute('src', 'assets/img/logo.png');
  await page.locator('header .brand-mark').evaluate((image: HTMLImageElement) => image.decode());
  await page.screenshot({ path: testInfo.outputPath('login-desktop.png'), fullPage: true });
  await page.route('**/reconect', route => route.fulfill({ json: { success: true, role: 0, user: 'u1', name: 'John Smith' } }));
  await page.route('**/get-cart', route => route.fulfill({ json: { success: true } }));
  await page.route('**/get-all-products', route => route.fulfill({ json: { success: true, products: [
    { id: 'p1', name: 'Market favourites', category: 'Vegetables & Fruits', price: 4.5, image: '/assets/img/market-basket.svg' },
    { id: 'p2', name: 'Pantry essentials', category: 'Wine & Drinks', price: 12.5, image: '/assets/img/market-basket.svg' },
    { id: 'p3', name: 'Fresh picks', category: 'Milk & Eggs', price: 8.5, image: '/assets/img/market-basket.svg' },
  ] } }));
  await page.goto('/#/store');
  await expect(page.locator('.product')).toHaveCount(3);
  await page.locator('.store-hero > img').evaluate((image: HTMLImageElement) => image.decode());
  await page.locator('.product img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  await page.screenshot({ path: testInfo.outputPath('store-desktop.png'), fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('heading', { name: 'Store', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('store-mobile.png'), fullPage: true });
});
