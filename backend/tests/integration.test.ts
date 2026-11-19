import { randomBytes } from 'node:crypto';
import { before, after, test } from 'node:test';
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import * as net from 'node:net';
import { once } from 'node:events';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
const { createStorageClient } = require('../dist/services/image-storage.service');
const User = require('../dist/models/User');
const Product = require('../dist/models/Product');
const Cart = require('../dist/models/Cart');
const Order = require('../dist/models/Order');
const { AuthRateLimitStore } = require('../dist/stores/auth-rate-limit.store');

test('Redis rate limits are atomic across replicas and expire without extending the window', async () => {
  const first = new AuthRateLimitStore();
  const second = new AuthRateLimitStore();
  const key = `integration:${randomBytes(16).toString('hex')}`;
  try {
    await Promise.all([first.onModuleInit(), second.onModuleInit()]);
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => (i % 2 ? first : second).consume(key, 20, 1000)),
    );
    assert.equal(results.filter((result) => result.allowed).length, 20);
    assert.equal(results.filter((result) => !result.allowed).length, 20);
    assert.ok(results.every((result) => result.retryAfter === 1));
    first.onModuleDestroy();
    assert.equal((await second.consume(key, 20, 1000)).allowed, false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal((await second.consume(key, 20, 1000)).allowed, true);
  } finally {
    first.onModuleDestroy();
    second.onModuleDestroy();
  }
});

let server: ChildProcessByStdio<null, Readable, Readable>;
let base: string, temporaryDirectory: string, customerCookie: string, adminCookie: string;
let logs = '';
const password = 'Integration123!';
const registration = {
  firstName: 'Alice',
  lastName: 'Shopper',
  email: 'alice@example.com',
  pass: password,
  id: '123456789',
  city: 'London',
  street: 'High Street',
};

async function csrfHeaders(cookie = '') {
  const bootstrap = await fetch(base + '/api/auth/csrf-token', {
    headers: cookie ? { Cookie: cookie } : {},
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(bootstrap.status, 200);
  const xsrfCookie = bootstrap.headers
    .getSetCookie()
    .find((value) => value.startsWith('XSRF-TOKEN='))!
    .split(';')[0]!;
  return {
    Cookie: [cookie, xsrfCookie].filter(Boolean).join('; '),
    'X-XSRF-TOKEN': decodeURIComponent(xsrfCookie.slice('XSRF-TOKEN='.length)),
  };
}

async function request(
  route: string,
  {
    method = 'GET',
    body,
    cookie,
    status = 200,
  }: { method?: string; body?: unknown; cookie?: string; status?: number } = {},
) {
  const response = await fetch(base + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(method === 'GET' ? (cookie ? { Cookie: cookie } : {}) : await csrfHeaders(cookie)),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, status, route);
  return { body: await response.json(), cookie: response.headers.get('set-cookie') };
}

before(
  async () => {
    const uri = process.env['MONGODB_URI'];
    // This suite clears its database. Refuse the application's normal database.
    assert.ok(
      uri && /^mongodb:\/\/[^/]+\/shop_integration(?:\?|$)/.test(uri),
      'MONGODB_URI must point to a dedicated shop_integration database',
    );
    await mongoose.connect(uri);
    await Promise.all([User.init(), Product.init(), Cart.init(), Order.init()]);
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Cart.deleteMany({}),
      Order.deleteMany({}),
    ]);
    await User.create({
      id: 987654321,
      username: 'admin@example.com',
      password: bcrypt.hashSync(password, bcrypt.genSaltSync(4)),
      name: { first_name: 'Admin', last_name: 'User' },
      address: { city: 'Tel Aviv', street: 'Ha Masger 10' },
      role: 1,
    });
    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'shop-integration-'));
    const keyPath = path.join(temporaryDirectory, 'key.pem');
    writeFileSync(keyPath, randomBytes(48).toString('hex'));
    const portProbe = net.createServer();
    portProbe.listen(0, '127.0.0.1');
    await once(portProbe, 'listening');
    const port = (portProbe.address() as AddressInfo).port;
    await new Promise<void>((resolve, reject) =>
      portProbe.close((error?: Error) => (error ? reject(error) : resolve())),
    );
    base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['dist/main.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(port), JWT_KEY_PATH: keyPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (data) => {
      logs += data;
    });
    server.stderr.on('data', (data) => {
      logs += data;
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(server.exitCode, null, logs);
      try {
        const response = await fetch(base, { signal: AbortSignal.timeout(500) });
        if (response.ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Application did not start: ${logs}`);
  },
  { timeout: 30000 },
);

after(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
  await mongoose.disconnect();
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('public storefront is served and protected routes reject anonymous requests', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<html/i);
  for (const route of [
    '/api/products',
    '/api/carts/current',
    '/api/auth/session',
    '/api/products/count',
  ]) {
    assert.deepEqual((await request(route, { status: 401 })).body, { success: false });
  }
});

test('signup persists a hashed password, rejects duplicates, and login creates a session', async () => {
  const available = await request('/api/auth/signup/availability', {
    method: 'POST',
    body: { email: registration.email, id: registration.id },
  });
  assert.equal(available.body.available, true);
  assert.deepEqual(
    (await request('/api/auth/signup', { method: 'POST', body: registration })).body,
    {
      success: true,
    },
  );
  const user = await User.findOne({ username: registration.email });
  assert.notEqual(user.password, password);
  assert.ok(bcrypt.compareSync(password, user.password));
  assert.equal(user.role, 0);
  for (const [email, id, emailExists, idExists] of [
    [registration.email, registration.id, true, true],
    [registration.email, '333444555', true, false],
    ['different@example.com', registration.id, false, true],
  ] as const) {
    const result = await request('/api/auth/signup/availability', {
      method: 'POST',
      body: { email, id },
    });
    assert.equal(result.body.available, false);
    assert.equal(result.body.emailExists, emailExists);
    assert.equal(result.body.idExists, idExists);
  }
  const duplicateId = await request('/api/auth/signup', {
    method: 'POST',
    body: { ...registration, email: 'different@example.com' },
  });
  assert.equal(duplicateId.body.success, false);
  assert.equal(duplicateId.body.reason, 'This ID number is already registered.');

  assert.equal(
    (await request('/api/auth/signup', { method: 'POST', body: registration })).body.success,
    false,
  );
  for (const credentials of [
    { username: 'invalid', password: 'short' },
    { username: registration.email, password: 'Incorrect123' },
    { username: 'missing@example.com', password },
  ]) {
    assert.deepEqual(
      (await request('/api/auth/login', { method: 'POST', body: credentials, status: 401 })).body,
      {
        success: false,
      },
    );
  }
  for (const [username, role] of [
    [registration.email, 0],
    ['admin@example.com', 1],
  ]) {
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    assert.equal(login.body.success, true);
    assert.equal(login.body.role, role);
    assert.equal(login.body.isReturning, role !== 0);
    assert.ok(login.cookie, 'Login must set a session cookie');
    assert.match(login.cookie, /HttpOnly/i);
    const cookie = login.cookie.split(';')[0];
    if (role === 0) customerCookie = cookie;
    else adminCookie = cookie;
    const session = await request('/api/auth/session', { cookie });
    assert.deepEqual(session.body, login.body);
  }
});

test('a second login is recognized without any prior purchases', async () => {
  assert.equal(await Order.countDocuments({ user_id: Number(registration.id) }), 0);
  assert.equal((await User.findOne({ username: registration.email })).has_logged_in, true);
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username: registration.email, password },
  });
  assert.equal(login.body.isReturning, true);
  customerCookie = login.cookie!.split(';')[0];
  assert.equal(
    (await request('/api/auth/session', { cookie: customerCookie })).body.isReturning,
    true,
  );
});

test('admin product writes persist, validate input, and enforce customer permissions', async () => {
  const product = {
    name: 'Test Milk',
    category: 'Milk & Eggs',
    price: '4.50',
    image: 'test-milk.png',
  };
  const add = (body: unknown, cookie = adminCookie) =>
    request('/api/products/create', {
      method: 'POST',
      body,
      cookie,
      status: cookie === adminCookie ? 200 : 403,
    });
  assert.equal((await add(product, customerCookie)).body.success, false);
  assert.equal(await Product.countDocuments({}), 0);
  assert.equal((await add({ ...product, category: 'Invalid' })).body.success, false);
  assert.equal((await add({ ...product, price: '4' })).body.success, false);
  const additions = await Promise.all([add(product), add({ ...product, image: 'other-milk.png' })]);
  assert.deepEqual(additions.map(({ body }) => body.success).sort(), [false, true]);
  const stored = await Product.findOne({ name: product.name });
  assert.equal(stored.price, 4.5);
  const edit = { ...product, id: String(stored._id), price: '5.25' };
  assert.equal(
    (
      await request('/api/products/update', {
        method: 'POST',
        body: edit,
        cookie: customerCookie,
        status: 403,
      })
    ).body.success,
    false,
  );
  assert.equal(
    (await request('/api/products/update', { method: 'POST', body: edit, cookie: adminCookie }))
      .body.success,
    true,
  );
  assert.equal((await Product.findById(stored._id)).price, 5.25);
  const catalog = (await request('/api/products', { cookie: customerCookie })).body;
  assert.equal(catalog.success, true);
  assert.deepEqual(catalog.products, [{ id: String(stored._id), ...product, price: 5.25 }]);
  const category = await request('/api/products/by-category', {
    method: 'POST',
    cookie: customerCookie,
    body: { category: product.category },
  });
  assert.deepEqual(category.body, catalog);
  const search = await request('/api/products/search', {
    method: 'POST',
    cookie: customerCookie,
    body: { name: 'test milk' },
  });
  assert.deepEqual(search.body, catalog);
  assert.equal((await request('/api/products/count', { cookie: customerCookie })).body.count, 1);
});

test('customer cart creation, duplicate rejection, update and retrieval use MongoDB', async () => {
  assert.deepEqual((await request('/api/carts/current', { cookie: customerCookie })).body, {
    success: true,
    cart: null,
  });
  const create = (cookie: string) =>
    request('/api/carts', {
      method: 'POST',
      body: { products: [] },
      cookie,
      status: cookie === adminCookie ? 403 : 200,
    });
  assert.equal((await create(adminCookie)).body.success, false);
  const creation = (await create(customerCookie)).body;
  const created = creation.cart;
  assert.equal(creation.success, true);
  assert.ok(created.id);
  assert.ok(created.createdAt);
  assert.equal((await create(customerCookie)).body.success, false);
  assert.equal(await Cart.countDocuments({}), 1);
  const product = await Product.findOne({});
  const products = [{ id: String(product._id), count: 2, price: product.price }];
  assert.equal(
    (
      await request('/api/carts/update', {
        method: 'POST',
        cookie: customerCookie,
        body: { products },
      })
    ).body.success,
    false,
  );
  assert.equal(
    (
      await request('/api/carts/update', {
        method: 'POST',
        cookie: customerCookie,
        body: { id: created.id, products: [{ ...products[0], price: -100 }] },
      })
    ).body.success,
    true,
  );
  const cart = (await request('/api/carts/current', { cookie: customerCookie })).body.cart;
  assert.equal(cart.id, created.id);
  assert.deepEqual(cart.products, products);
  assert.deepEqual((await Cart.findById(created.id)).toObject().products, products);
  assert.equal((await request('/api/orders/count', { cookie: customerCookie })).body.count, 0);
});

test('concurrent cart creation allows one open cart while preserving closed carts', async () => {
  const userId = Number(registration.id);
  await Cart.updateMany({ user_id: userId, status: 1 }, { $set: { status: 0 } });
  const closedCount = await Cart.countDocuments({ user_id: userId, status: 0 });
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      request('/api/carts', {
        method: 'POST',
        cookie: customerCookie,
        body: { products: [] },
      }),
    ),
  );
  assert.equal(results.filter((result) => result.body.success).length, 1);
  assert.equal(results.filter((result) => result.body.success === false).length, 9);
  assert.equal(await Cart.countDocuments({ user_id: userId, status: 1 }), 1);
  assert.equal(await Cart.countDocuments({ user_id: userId, status: 0 }), closedCount);
  await assert.rejects(
    Cart.create({ user_id: userId, products: [], created_at: new Date(), status: 1 }),
    (error: any) => error.code === 11000,
  );
  await Cart.create({ user_id: userId + 1, products: [], created_at: new Date(), status: 1 });
});

test('checkout saves shipping and demo payment once, closes the cart, and survives retries', async () => {
  const cart = await Cart.findOne({ user_id: Number(registration.id), status: 1 });
  const product = await Product.findOne({});
  // The cart still has the unit price the customer saw before the catalog changed.
  const reviewedItems = [{ id: String(product._id), count: 2, unitPriceCents: 425 }];
  await Cart.updateOne(
    { _id: cart._id },
    { $set: { products: [{ id: String(product._id), count: 2, price: 4.25 }] } },
    { runValidators: true },
  );
  const body = {
    cartId: String(cart._id),
    reviewedItems,
    shipping: { city: 'Tel Aviv', street: 'Ha Masger 10', date: '2099-12-01' },
    payment: { method: 'credit_card', last4: '4242' },
    total: 0.01,
  };
  assert.equal(
    (
      await request('/api/orders/checkout', {
        method: 'POST',
        cookie: adminCookie,
        body,
        status: 403,
      })
    ).body.success,
    false,
  );
  assert.equal(
    (
      await request('/api/orders/checkout', {
        method: 'POST',
        cookie: customerCookie,
        body: { ...body, shipping: { ...body.shipping, date: '2000-01-01' } },
      })
    ).body.success,
    false,
  );
  const priceChange = await request('/api/orders/checkout', {
    method: 'POST',
    cookie: customerCookie,
    body,
  });
  assert.equal(priceChange.body.success, false);
  assert.equal(priceChange.body.review.products[0].price, product.price);
  assert.equal(await Order.countDocuments({ cart_id: body.cartId }), 0);
  assert.equal((await Cart.findById(cart._id)).status, 1);
  const confirmed = {
    ...body,
    reviewedItems: [{ ...reviewedItems[0], unitPriceCents: Math.round(product.price * 100) }],
  };
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      request('/api/orders/checkout', { method: 'POST', cookie: customerCookie, body: confirmed }),
    ),
  );
  assert.ok(results.every((result) => result.body.success));
  assert.equal(new Set(results.map((result) => result.body.order.id)).size, 1);
  assert.equal(await Order.countDocuments({ cart_id: body.cartId }), 1);
  const order = await Order.findOne({ cart_id: body.cartId }).lean();
  assert.equal(order.price, product.price * 2);
  assert.equal(order.shipping.city, body.shipping.city);
  assert.equal(order.shipping.date.toISOString().slice(0, 10), body.shipping.date);
  assert.deepEqual(order.payment, { mode: 'demo', method: 'credit_card', last4: '4242' });
  assert.equal(order.credit_card, undefined);
  assert.equal((await Cart.findById(cart._id)).status, 0);
  assert.equal((await request('/api/carts/current', { cookie: customerCookie })).body.cart, null);
  assert.deepEqual(
    (await request('/api/orders/latest', { cookie: customerCookie })).body,
    results[0].body,
  );
  const repeated = await request('/api/orders/checkout', {
    method: 'POST',
    cookie: customerCookie,
    body: confirmed,
  });
  assert.equal(repeated.body.order.id, String(order._id));
  assert.equal(
    (
      await request('/api/carts', {
        method: 'POST',
        cookie: customerCookie,
        body: { products: [] },
      })
    ).body.success,
    true,
  );
});

test('invoice PDFs persist in MinIO, preserve the order snapshot, and enforce ownership', async () => {
  const order = await Order.findOne({
    user_id: Number(registration.id),
    'payment.mode': 'demo',
  }).lean();
  const url = `/orders/${order._id}/invoice`;
  const invoiceKey = `invoices/${order._id}.pdf`;
  assert.equal(order.products[0].name, 'Test Milk');
  const download = await fetch(base + url, { headers: { Cookie: customerCookie } });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.match(
    download.headers.get('content-disposition')!,
    /attachment; filename="invoice-.*\.pdf"/,
  );
  const bytes = Buffer.from(await download.arrayBuffer());
  assert.match(bytes.toString(), /^%PDF-/);
  assert.ok(bytes.includes(Buffer.from('Test Milk')));
  assert.ok(bytes.includes(Buffer.from('$5.25')));
  const client = createStorageClient();
  try {
    const stored = await client.send(
      new GetObjectCommand({
        Bucket: process.env['S3_BUCKET'] || 'product-images',
        Key: invoiceKey,
      }),
    );
    assert.equal(stored.ContentType, 'application/pdf');
    assert.deepEqual(Buffer.from(await stored.Body.transformToByteArray()), bytes);
    // Subsequent catalog changes must not alter the PDF or its saved line names/prices.
    await Product.updateOne(
      { _id: order.products[0].id },
      { $set: { name: 'Changed after checkout', price: 99 } },
    );
    const second = await fetch(base + url, { headers: { Cookie: customerCookie } });
    assert.deepEqual(Buffer.from(await second.arrayBuffer()), bytes);
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: process.env['S3_BUCKET'] || 'product-images',
        Key: invoiceKey,
      }),
    );
    assert.equal(head.ETag, stored.ETag);
  } finally {
    client.destroy();
  }
  assert.deepEqual((await request(url, { status: 401 })).body, { success: false });
  assert.deepEqual((await request(url, { cookie: adminCookie, status: 403 })).body, {
    success: false,
  });
  await request('/api/auth/signup', {
    method: 'POST',
    body: { ...registration, id: '222333444', email: 'other@example.com' },
  });
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'other@example.com', password },
  });
  const denied = await fetch(base + url, { headers: { Cookie: login.cookie!.split(';')[0] } });
  assert.equal(denied.status, 404);
  const publicAttempt = await fetch(base + `/products/uploads/invoices/${order._id}.pdf`);
  assert.equal(publicAttempt.status, 404);
});

test('product images are stored, served, replaced and deleted with their product', async () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
  const product = { name: 'Uploaded image product', category: 'Milk & Eggs', price: '5.00' };
  const save = async (id?: string) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(product)) form.append(key, value);
    if (id) form.append('id', id);
    form.append('image', new Blob([bytes], { type: 'image/png' }), 'test.png');
    const response = await fetch(base + (id ? '/api/products/update' : '/api/products/create'), {
      method: 'POST',
      headers: await csrfHeaders(adminCookie),
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
    return Product.findOne({ name: product.name }).orFail();
  };
  const created = await save();
  assert.match(created.image, /^\/products\/uploads\/[a-f0-9-]+\.png$/);
  const originalImage = await fetch(base + created.image, { signal: AbortSignal.timeout(5000) });
  assert.equal(originalImage.status, 200);
  assert.equal(originalImage.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await originalImage.arrayBuffer()), bytes);
  const client = createStorageClient();
  const head = (url: string) =>
    client.send(
      new HeadObjectCommand({
        Bucket: process.env['S3_BUCKET'] || 'product-images',
        Key: url.split('/').pop(),
      }),
    );
  try {
    assert.equal((await head(created.image)).ContentLength, bytes.length);
    const updated = await save(String(created._id));
    assert.notEqual(updated.image, created.image);
    const missing = (error: any) => error.$metadata?.httpStatusCode === 404;
    await assert.rejects(head(created.image), missing);
    assert.equal((await head(updated.image)).ContentLength, bytes.length);
    assert.equal(
      (await fetch(base + created.image, { signal: AbortSignal.timeout(5000) })).status,
      404,
    );

    const deleted = await request('/api/products/delete', {
      method: 'POST',
      cookie: adminCookie,
      body: { id: String(created._id) },
    });
    assert.equal(deleted.body.success, true);
    await assert.rejects(head(updated.image), missing);
    assert.equal(
      (await fetch(base + updated.image, { signal: AbortSignal.timeout(5000) })).status,
      404,
    );
  } finally {
    client.destroy();
  }
});

test('logout expires the browser session cookie and rejects the revoked session', async () => {
  const logout = await request('/api/auth/logout', { method: 'POST', cookie: customerCookie });
  assert.equal(logout.body.success, true);
  assert.ok(logout.cookie, 'Logout must expire the session cookie');
  assert.match(logout.cookie, /SESSIONID=;/);
  assert.match(logout.cookie, /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('/api/auth/session', { status: 401 })).body.success, false);
  assert.equal(
    (await request('/api/auth/session', { cookie: customerCookie, status: 401 })).body.success,
    false,
  );
});

test('only administrators can delete products and deletion persists in MongoDB', async () => {
  const product = await Product.create({
    name: 'Disposable product',
    category: 'Milk & Eggs',
    price: 1.25,
    image: '/products/edam.png',
  });
  const body = { id: String(product._id) };
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username: registration.email, password },
  });
  const activeCustomerCookie = login.cookie!.split(';')[0];
  await request('/api/products/delete', {
    method: 'POST',
    body,
    cookie: activeCustomerCookie,
    status: 403,
  });
  assert.ok(await Product.findById(product._id));
  assert.equal(
    (await request('/api/products/delete', { method: 'POST', body, cookie: adminCookie })).body
      .success,
    true,
  );
  assert.equal(await Product.findById(product._id), null);
  const catalog = (await request('/api/products', { cookie: adminCookie })).body;
  assert.ok(!catalog.products.some((item: { id: string }) => item.id === body.id));
  assert.equal(
    (await request('/api/products/delete', { method: 'POST', body, cookie: adminCookie })).body
      .success,
    false,
  );
});
