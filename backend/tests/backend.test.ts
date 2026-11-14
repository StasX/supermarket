import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
const request = require('supertest');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
import * as bcrypt from 'bcryptjs';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { NotFoundException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
const { AppModule } = require('../dist/app.module');
const { AuthRateLimitGuard } = require('../dist/auth-rate-limit.guard');
let authRateLimiter = new AuthRateLimitGuard();
const { MODELS } = require('../dist/database.module');
const { ImageStorageService } = require('../dist/image-storage.service');
const { createInvoice } = require('../dist/invoice');
const images = new Map<string, Buffer>();
const invoiceWrite = jest.fn<(...args: any[]) => Promise<void>>();

describe('invoice storage conditional creation', () => {
  test('concurrent uploads use create-only writes and accept an existing invoice', async () => {
    const first = Buffer.from('first PDF');
    const second = Buffer.from('competing PDF');
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 412 } } as never);
    const storage = new ImageStorageService();
    try {
      await expect(
        Promise.all([storage.putInvoice('order-1', first), storage.putInvoice('order-1', second)]),
      ).resolves.toEqual([undefined, undefined]);
      expect(send).toHaveBeenCalledTimes(2);
      for (const [index, bytes] of [first, second].entries()) {
        const command = send.mock.calls[index]![0];
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect((command as PutObjectCommand).input).toMatchObject({
          Key: 'invoices/order-1.pdf',
          Body: bytes,
          ContentType: 'application/pdf',
          IfNoneMatch: '*',
        });
      }
    } finally {
      send.mockRestore();
      storage.onModuleDestroy();
    }
  });

  test.each([403, 409, 500, 503])(
    'upload failure %s is propagated instead of claiming an invoice was saved',
    async (status) => {
      const error = { $metadata: { httpStatusCode: status } };
      const send = jest.spyOn(S3Client.prototype, 'send').mockRejectedValue(error as never);
      const storage = new ImageStorageService();
      try {
        await expect(storage.putInvoice('order-1', Buffer.from('PDF'))).rejects.toBe(error);
      } finally {
        send.mockRestore();
        storage.onModuleDestroy();
      }
    },
  );
});

const customer = {
  _id: '507f1f77bcf86cd799439011',
  id: 123456789,
  username: 'buyer@example.com',
  name: { first_name: 'John', last_name: 'Smith' },
  role: 0,
};
const admin = { ...customer, _id: '507f1f77bcf86cd799439012', role: 1 };
const key = 'test-only-session-signing-key';
let app: INestApplication;
type Collection = 'users' | 'products' | 'carts' | 'orders';
type ModelMethod =
  'find' | 'findOne' | 'create' | 'countDocuments' | 'findByIdAndUpdate' | 'findOneAndUpdate';
type MockModels = Record<Collection, Record<ModelMethod, jest.Mock<(...args: any[]) => any>>>;
let models: MockModels;
let directory: string;
let oldKeyPath: string | undefined;
const cookie = (user = customer, options = {}) =>
  `SESSIONID=${jwt.sign({}, key, { subject: user._id, expiresIn: '1h', ...options })}`;
const api = () => request(app.getHttpServer());
const checkoutBody = {
  cartId: customer._id,
  shipping: { city: 'Tel Aviv', street: 'Ha Masger 10', date: '2099-12-01' },
  payment: { method: 'credit_card', last4: '4242' },
};

test.each([null, admin])('checkout requires a customer session (%s)', async (user) => {
  const call = api().post('/checkout');
  if (user) call.set('Cookie', cookie(user));
  expect((await call.send(checkoutBody).expect(user ? 403 : 401)).body.success).toBe(false);
});

test.each([
  { ...checkoutBody, shipping: { ...checkoutBody.shipping, city: ' ' } },
  { ...checkoutBody, shipping: { ...checkoutBody.shipping, date: '2000-01-01' } },
  { ...checkoutBody, shipping: { ...checkoutBody.shipping, date: '2099-02-30' } },
  { ...checkoutBody, payment: { method: 'credit_card', last4: '123' } },
  { ...checkoutBody, payment: { ...checkoutBody.payment, number: '4242424242424242', cvc: '123' } },
])('checkout rejects invalid shipping or payment data (%j)', async (body) => {
  expect((await api().post('/checkout').set('Cookie', cookie()).send(body)).body.success).toBe(
    false,
  );
  expect(models.carts.findOne).not.toHaveBeenCalled();
});

test.each([
  { last4: '4242', city: 'Saint-Étienne', street: '12 O’Connell St., #4/2' },
  { last4: '5800', city: 'תל אביב', street: 'דרך בן-גוריון 10' },
  { last4: '0000', city: '北京', street: '北京市东路8号' },
])(
  'checkout uses catalog prices and persists only demo payment metadata (%s)',
  async ({ last4, city, street }) => {
    const products = [{ id: admin._id, count: 2, price: 0.01 }];
    models.carts.findOne.mockResolvedValue({ _id: customer._id, status: 1, products });
    models.products.find.mockResolvedValue([{ _id: admin._id, name: 'Apple juice', price: 5.25 }]);
    models.carts.findOneAndUpdate.mockImplementation(async (_query, update) => ({
      status: 0,
      checkout: update.$set.checkout,
    }));
    models.orders.findOneAndUpdate.mockImplementation(async (_query, update) => ({
      _id: 'order1',
      ...update.$setOnInsert,
    }));
    const response = await api()
      .post('/checkout')
      .set('Cookie', cookie())
      .send({
        ...checkoutBody,
        shipping: { ...checkoutBody.shipping, city, street },
        payment: { method: 'credit_card', last4 },
        total: 0.01,
      });
    expect(response.body).toMatchObject({
      success: true,
      order: { id: 'order1', total: 10.5, payment: { mode: 'demo', last4 } },
    });
    const saved = models.orders.findOneAndUpdate.mock.calls[0][1].$setOnInsert;
    expect(saved.shipping).toMatchObject({ city, street });
    expect(response.body.order.shipping).toMatchObject({ city, street });
    expect(saved.products).toEqual([{ id: admin._id, name: 'Apple juice', count: 2, price: 5.25 }]);
    expect(response.body.order.invoiceUrl).toBe('/orders/order1/invoice');
    const invoice = images.get('invoices/order1.pdf')!;
    expect(invoice.toString()).toMatch(/^%PDF-/);
    expect(invoice.toString()).toContain('Apple juice');
    expect(invoice.toString()).toContain('$5.25');
    expect(saved).not.toHaveProperty('credit_card');
    expect(saved.payment).toEqual({ mode: 'demo', method: 'credit_card', last4 });
    expect(models.carts.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      _id: customer._id,
      user_id: customer.id,
      status: 1,
      products,
    });
  },
);

test('checkout rejects another customer cart or an empty cart', async () => {
  models.carts.findOne.mockResolvedValue(null);
  expect(
    (await api().post('/checkout').set('Cookie', cookie()).send(checkoutBody)).body.success,
  ).toBe(false);
  expect(models.carts.findOne).toHaveBeenCalledWith({ _id: customer._id, user_id: customer.id });
  models.carts.findOne.mockResolvedValue({ _id: customer._id, status: 1, products: [] });
  expect(
    (await api().post('/checkout').set('Cookie', cookie()).send(checkoutBody)).body.success,
  ).toBe(false);
  expect(models.orders.findOneAndUpdate).not.toHaveBeenCalled();
});

test('checkout retries a closed cart using its original snapshot', async () => {
  const snapshot = {
    cart_id: customer._id,
    price: 12,
    shipping: checkoutBody.shipping,
    payment: { mode: 'demo', method: 'credit_card', last4: '4242' },
  };
  models.carts.findOne.mockResolvedValue({ status: 0, checkout: snapshot });
  models.orders.findOneAndUpdate.mockResolvedValue({ _id: 'order1', ...snapshot });
  const response = await api().post('/checkout').set('Cookie', cookie()).send(checkoutBody);
  expect(response.body).toMatchObject({ success: true, order: { id: 'order1', total: 12 } });
  expect(models.carts.findOneAndUpdate).not.toHaveBeenCalled();
  expect(models.orders.findOneAndUpdate.mock.calls[0][1]).toEqual({ $setOnInsert: snapshot });
});

test.each([
  'after cart closure',
  'before order insert',
  'after order insert',
  'before invoice upload',
  'after invoice upload',
  'before invoice marker update',
])('checkout recovers from an interruption %s', async (failurePoint) => {
  // Keep durable state separate from returned documents to model a lost response
  // after a successful write, as well as failures before the next write starts.
  let cart: any = {
    _id: customer._id,
    user_id: customer.id,
    status: 1,
    products: [{ id: admin._id, count: 2, price: 0.01 }],
  };
  let order: any;
  let interrupted = false;
  let orderCreates = 0;
  let invoiceCreates = 0;
  const invoiceKey = `invoices/${customer._id}.pdf`;
  const interrupt = (point: string) => {
    if (!interrupted && point === failurePoint) {
      interrupted = true;
      throw new Error(`Injected interruption ${point}`);
    }
  };
  models.products.find.mockResolvedValue([{ _id: admin._id, name: 'Original juice', price: 5.25 }]);
  models.carts.findOne.mockImplementation(async () => structuredClone(cart));
  models.carts.findOneAndUpdate.mockImplementation(async (_query, update) => {
    cart = { ...cart, ...structuredClone(update.$set) };
    interrupt('after cart closure');
    return structuredClone(cart);
  });
  models.orders.findOneAndUpdate.mockImplementation(async (_query, update) => {
    if (update.$setOnInsert) {
      interrupt('before order insert');
      if (!order) {
        order = { _id: customer._id, ...structuredClone(update.$setOnInsert) };
        orderCreates++;
      }
      interrupt('after order insert');
    } else {
      interrupt('before invoice marker update');
      Object.assign(order, update.$set);
    }
    return structuredClone(order);
  });
  invoiceWrite.mockImplementation(async (_id: string, bytes: Buffer) => {
    interrupt('before invoice upload');
    if (!images.has(invoiceKey)) {
      images.set(invoiceKey, Buffer.from(bytes));
      invoiceCreates++;
    }
    interrupt('after invoice upload');
  });

  await api().post('/checkout').set('Cookie', cookie()).send(checkoutBody).expect(500);
  expect(interrupted).toBe(true);
  expect(cart.status).toBe(0);
  expect(cart.checkout.price).toBe(10.5);
  const frozenSnapshot = structuredClone(cart.checkout);
  const originalInvoice = images.get(invoiceKey);
  if (['after cart closure', 'before order insert'].includes(failurePoint)) {
    expect(order).toBeUndefined();
    expect(invoiceWrite).not.toHaveBeenCalled();
  } else {
    expect(orderCreates).toBe(1);
    expect(order.invoiceKey).toBeUndefined();
  }
  if (['after invoice upload', 'before invoice marker update'].includes(failurePoint)) {
    expect(originalInvoice).toBeDefined();
  } else {
    expect(originalInvoice).toBeUndefined();
  }

  // Neither later catalog edits nor a changed retry payload may change a closed
  // cart's snapshot. Repeating checkout must recover the existing order/PDF.
  models.products.find.mockResolvedValue([{ _id: admin._id, name: 'Changed juice', price: 99 }]);
  const retryBody = {
    ...checkoutBody,
    shipping: { ...checkoutBody.shipping, street: 'Changed street' },
    payment: { method: 'credit_card', last4: '9999' },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await api().post('/checkout').set('Cookie', cookie()).send(retryBody).expect(200);
    expect(response.body).toMatchObject({
      success: true,
      order: {
        id: customer._id,
        total: 10.5,
        products: [{ name: 'Original juice', count: 2, price: 5.25 }],
        shipping: { street: checkoutBody.shipping.street },
        payment: { last4: '4242' },
        invoiceUrl: `/orders/${customer._id}/invoice`,
      },
    });
  }
  expect(cart.checkout).toEqual(frozenSnapshot);
  expect(orderCreates).toBe(1);
  expect(invoiceCreates).toBe(1);
  expect(order.invoiceKey).toBe(invoiceKey);
  expect(models.carts.findOneAndUpdate).toHaveBeenCalledTimes(1);
  expect(models.products.find).toHaveBeenCalledTimes(1);
  const invoice = images.get(invoiceKey)!;
  expect(invoice.toString()).toMatch(/^%PDF-/);
  expect(invoice.toString()).toContain('Original juice');
  expect(invoice.toString()).not.toContain('Changed juice');
  if (originalInvoice) expect(invoice).toEqual(originalInvoice);
});

test('PDF invoices include the review table, frozen line prices and shipping details', () => {
  const order = {
    _id: customer._id,
    price: 7.5,
    products: [{ id: admin._id, name: 'Apple juice', count: 3, price: 2.5 }],
    shipping: { city: 'Jerusalem', street: 'Jafo', date: new Date('2026-12-12') },
    payment: { last4: '4848' },
  };
  const content = createInvoice(order).toString();
  expect(content).toMatch(/^%PDF-/);
  expect(content).toContain('/Subtype /Image');
  for (const text of [
    'PRODUCT',
    'QUANTITY',
    'PRICE',
    'TOTAL',
    'Apple juice',
    '$2.50',
    'Total: $7.50',
    customer._id,
    'Jafo, Jerusalem',
    '2026-12-12',
    '4848',
  ]) {
    expect(content).toContain(text);
  }
  const large = createInvoice({
    ...order,
    products: Array.from({ length: 90 }, () => order.products[0]),
  }).toString();
  expect(large.match(/\/Type \/Page\b/g).length).toBeGreaterThan(1);
  expect(large.match(/\(PRODUCT\)/g).length).toBeGreaterThan(1);
});

test.each([null, admin])('invoice downloads require a customer session (%s)', async (user) => {
  const call = api().get(`/orders/${customer._id}/invoice`);
  if (user) call.set('Cookie', cookie(user));
  expect((await call.expect(user ? 403 : 401)).body).toEqual({ success: false });
  expect(models.orders.findOne).not.toHaveBeenCalled();
});

test.each(['invalid', customer._id])(
  'missing or another customer invoice is not disclosed (%s)',
  async (id) => {
    models.orders.findOne.mockResolvedValue(null);
    await api().get(`/orders/${id}/invoice`).set('Cookie', cookie()).expect(404);
    if (id === customer._id)
      expect(models.orders.findOne).toHaveBeenCalledWith({
        _id: id,
        user_id: customer.id,
        'payment.mode': 'demo',
      });
    expect(invoiceWrite).not.toHaveBeenCalled();
  },
);

test('invoice downloads return the stored PDF without regeneration or catalog queries', async () => {
  const bytes = Buffer.from('%PDF-1.3\noriginal persisted invoice');
  const invoiceKey = `invoices/${customer._id}.pdf`;
  images.set(invoiceKey, bytes);
  models.orders.findOne.mockResolvedValue({ _id: customer._id, user_id: customer.id, invoiceKey });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await api()
      .get(`/orders/${customer._id}/invoice`)
      .set('Cookie', cookie())
      .expect(200)
      .expect('Content-Type', /application\/pdf/);
    expect(response.body).toEqual(bytes);
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="invoice-${customer._id}.pdf"`,
    );
    expect(response.headers['cache-control']).toBe('private, no-store');
  }
  expect(invoiceWrite).not.toHaveBeenCalled();
  expect(models.products.find).not.toHaveBeenCalled();
});

test('checkout recovers from invoice storage failure without creating another order or closing another cart', async () => {
  const snapshot = {
    user_id: customer.id,
    price: 12,
    products: [{ id: admin._id, name: 'Frozen product name', count: 2, price: 6 }],
    shipping: checkoutBody.shipping,
    payment: { mode: 'demo', method: 'credit_card', last4: '4242' },
  };
  models.carts.findOne.mockResolvedValue({ status: 0, checkout: snapshot });
  models.orders.findOneAndUpdate.mockImplementation(async (_query, update) => ({
    _id: customer._id,
    ...update.$setOnInsert,
  }));
  invoiceWrite.mockRejectedValueOnce(new Error('Object storage temporarily unavailable'));
  await api().post('/checkout').set('Cookie', cookie()).send(checkoutBody).expect(500);
  const retried = await api()
    .post('/checkout')
    .set('Cookie', cookie())
    .send(checkoutBody)
    .expect(200);
  expect(retried.body.order.invoiceUrl).toBe(`/orders/${customer._id}/invoice`);
  expect(images.get(`invoices/${customer._id}.pdf`)!.toString()).toContain('Frozen product name');
  expect(models.carts.findOneAndUpdate).not.toHaveBeenCalled();
  expect(models.products.find).not.toHaveBeenCalled();
  expect(models.orders.findOneAndUpdate).toHaveBeenLastCalledWith(
    { _id: customer._id },
    { $set: { invoiceKey: `invoices/${customer._id}.pdf` } },
  );
});

test('S3 storage signs path-style requests, preserves image bytes, and maps missing objects to 404', async () => {
  const keys = [
    'S3_ENDPOINT',
    'S3_FORCE_PATH_STYLE',
    'S3_BUCKET',
    'S3_CREATE_BUCKET',
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ];
  const previous = keys.map((key) => process.env[key]);
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  let storedInvoice: Buffer | undefined;
  const received: {
    method?: string;
    url?: string;
    authorization?: string;
    ifNoneMatch?: string;
    body: Buffer;
  }[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    received.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      ifNoneMatch: req.headers['if-none-match'],
      body: Buffer.concat(chunks),
    });
    if (req.url?.includes('missing')) {
      res.writeHead(404, { 'Content-Type': 'application/xml' });
      res.end('<Error><Code>NoSuchKey</Code><Message>Missing image</Message></Error>');
    } else if (req.url?.includes('/invoices/') && req.method === 'PUT') {
      if (storedInvoice) {
        res.writeHead(412, { 'Content-Type': 'application/xml' });
        res.end('<Error><Code>PreconditionFailed</Code></Error>');
      } else {
        storedInvoice = Buffer.concat(chunks);
        res.writeHead(200);
        res.end();
      }
    } else if (req.url?.includes('/invoices/') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end(storedInvoice);
    } else if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(bytes);
    } else {
      res.writeHead(200);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  let storage: InstanceType<typeof ImageStorageService> | undefined;
  try {
    Object.assign(process.env, {
      S3_ENDPOINT: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      S3_FORCE_PATH_STYLE: 'true',
      S3_BUCKET: 'test-images',
      S3_CREATE_BUCKET: 'true',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-access',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
    });
    storage = new ImageStorageService();
    await storage.onModuleInit();
    await storage.put('abc.png', bytes, 'image/png');
    const stream = await storage.get('abc.png');
    const downloaded: Buffer[] = [];
    for await (const chunk of stream) downloaded.push(Buffer.from(chunk));
    expect(Buffer.concat(downloaded)).toEqual(bytes);
    await expect(storage.get('missing.png')).rejects.toBeInstanceOf(NotFoundException);
    await expect(storage.get('../unsafe.png')).rejects.toBeInstanceOf(NotFoundException);
    const pdf = Buffer.from('%PDF-original');
    await storage.putInvoice(customer._id, pdf);
    await storage.putInvoice(customer._id, Buffer.from('%PDF-replacement'));
    const invoiceStream = await storage.getInvoice(customer._id);
    const invoiceChunks: Buffer[] = [];
    for await (const chunk of invoiceStream) invoiceChunks.push(Buffer.from(chunk));
    expect(Buffer.concat(invoiceChunks)).toEqual(pdf);
    expect(
      received
        .filter((item) => item.method === 'PUT' && item.url?.includes('/invoices/'))
        .every((item) => item.ifNoneMatch === '*'),
    ).toBe(true);
    await expect(storage.get(`invoices/${customer._id}.pdf`)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(received[0].method).toBe('HEAD');
    const upload = received.find((item) => item.method === 'PUT');
    if (!upload) throw new Error('S3 upload request was not received');
    expect(upload.url).toContain('/test-images/abc.png');
    expect(upload.authorization).toContain('AWS4-HMAC-SHA256 Credential=test-access/');
    expect(upload.body).toEqual(bytes);
  } finally {
    storage?.onModuleDestroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});

beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'supermarket-nest-'));
  oldKeyPath = process.env['JWT_KEY_PATH'];
  process.env['JWT_KEY_PATH'] = path.join(directory, 'session.key');
  fs.writeFileSync(process.env['JWT_KEY_PATH'], key);
  models = Object.fromEntries(
    ['users', 'products', 'orders', 'carts'].map((name) => [
      name,
      Object.fromEntries(
        [
          'find',
          'findOne',
          'create',
          'countDocuments',
          'findByIdAndUpdate',
          'findOneAndUpdate',
        ].map((method) => [method, jest.fn<(...args: any[]) => any>()]),
      ),
    ]),
  ) as MockModels;
  const adapter = new ExpressAdapter();
  const adapterHost = new HttpAdapterHost();
  adapterHost.httpAdapter = adapter;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(AuthRateLimitGuard)
    .useValue({ canActivate: (context: any) => authRateLimiter.canActivate(context) })
    .overrideProvider(MODELS)
    .useValue(models)
    .overrideProvider(ImageStorageService)
    .useValue({
      putInvoice: (id: string, bytes: Buffer) => invoiceWrite(id, bytes),
      getInvoice: async (id: string) => {
        const bytes = images.get(`invoices/${id}.pdf`);
        if (!bytes) throw new NotFoundException();
        return Readable.from(bytes);
      },
      put: async (filename: string, bytes: Buffer) => {
        images.set(filename, bytes);
      },
      get: async (filename: string) => {
        const bytes = images.get(filename);
        if (!bytes) throw new NotFoundException();
        return Readable.from(bytes);
      },
    })
    .overrideProvider(HttpAdapterHost)
    .useValue(adapterHost)
    .compile();
  app = module.createNestApplication(adapter);
  app.use(cookieParser());
  await app.init();
});

beforeEach(() => {
  authRateLimiter = new AuthRateLimitGuard();
  jest.resetAllMocks();
  images.clear();
  invoiceWrite.mockImplementation(async (id: string, bytes: Buffer) => {
    if (!images.has(`invoices/${id}.pdf`)) images.set(`invoices/${id}.pdf`, bytes);
  });
  models.users.findOne.mockImplementation(async (query) =>
    query._id === admin._id ? admin : query._id === customer._id ? customer : null,
  );
  models.users.findOneAndUpdate.mockResolvedValue(customer);
  models.products.find.mockResolvedValue([]);
});

afterAll(async () => {
  if (app) await app.close();
  if (oldKeyPath === undefined) delete process.env['JWT_KEY_PATH'];
  else process.env['JWT_KEY_PATH'] = oldKeyPath;
  if (directory) {
    fs.unlinkSync(path.join(directory, 'session.key'));
    fs.rmdirSync(directory);
  }
});

test('serves the compiled Angular application', async () => {
  const response = await api().get('/').expect(200);
  expect(response.text).toContain('<app-root>');
  const main = response.text.match(/src="([^"]*main[^\"]*\.js)"/);
  expect(main).not.toBeNull();
  await api()
    .get('/' + main[1])
    .expect(200);
});

test.each([
  'edam',
  'mascarpone',
  'ricotta',
  'cheddar',
  'emmentaler',
  'feta',
  'red-apple',
  'steak',
  'apple-juice',
  'fish',
])('serves the generated %s product image without authentication', async (name) => {
  const response = await api()
    .get(`/products/${name}.png`)
    .expect(200)
    .expect('Content-Type', /image\/png/);
  expect(
    response.body.equals(
      fs.readFileSync(path.join(__dirname, '..', 'static', 'products', `${name}.png`)),
    ),
  ).toBe(true);
});

test('missing product images return 404', async () => {
  await api().get('/products/missing.png').expect(404);
});

test.each([null, customer])('image uploads require an administrator (%s)', async (user) => {
  const call = api().post('/upload-product-image');
  if (user) call.set('Cookie', cookie(user));
  const result = await call
    .attach('image', Buffer.from('not an image'), 'image.png')
    .expect(user ? 403 : 401);
  expect(result.body).toEqual({ success: false });
});

test('uploads detect image format from content and serve the saved file', async () => {
  const source = path.join(__dirname, '..', 'static', 'products', 'edam.png');
  const response = await api()
    .post('/upload-product-image')
    .set('Cookie', cookie(admin))
    .attach('image', source, { filename: '../../untrusted.jpg', contentType: 'image/jpeg' })
    .expect(200);
  expect(response.body.image).toMatch(/^\/products\/uploads\/[a-f0-9-]+\.png$/);
  const served = await api()
    .get(response.body.image)
    .expect(200)
    .expect('Content-Type', /image\/png/);
  expect(served.body.equals(fs.readFileSync(source))).toBe(true);
});

test('missing uploaded images return 404', async () => {
  await api().get('/products/uploads/00000000-0000-0000-0000-000000000000.png').expect(404);
});

test('uploads reject missing files and disguised non-images', async () => {
  await api().post('/upload-product-image').set('Cookie', cookie(admin)).expect(400);
  await api()
    .post('/upload-product-image')
    .set('Cookie', cookie(admin))
    .attach('image', Buffer.from('<svg onload="alert(1)"></svg>'), {
      filename: 'image.png',
      contentType: 'image/png',
    })
    .expect(400);
});

test('uploads reject files larger than 5 MB', async () => {
  await api()
    .post('/upload-product-image')
    .set('Cookie', cookie(admin))
    .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png')
    .expect(413);
});

test.each([
  undefined,
  'invalid',
  jwt.sign({}, 'wrong-key'),
  jwt.sign({ sub: customer._id, exp: 1 }, key),
])('rejects missing, malformed, invalid-signature and expired sessions (%s)', async (token) => {
  const call = api().get('/get-all-products');
  if (token) call.set('Cookie', `SESSIONID=${token}`);
  expect((await call.expect(401)).body).toEqual({ success: false });
  expect(models.products.find).not.toHaveBeenCalled();
});

test('listing maps product fields and excludes internal data', async () => {
  models.products.find.mockResolvedValue([
    {
      _id: 'p1',
      name: 'Juice',
      price: 10,
      image: 'juice.png',
      category: 'Wine & Drinks',
      internal: 'hidden',
    },
  ]);
  expect((await api().get('/get-all-products').set('Cookie', cookie()).expect(200)).body).toEqual({
    success: true,
    products: [
      { id: 'p1', name: 'Juice', price: 10, image: 'juice.png', category: 'Wine & Drinks' },
    ],
  });
});

test('listing handles an empty collection', async () => {
  expect((await api().get('/get-all-products').set('Cookie', cookie())).body).toEqual({
    success: true,
    products: [],
  });
});

test.each(['Wine & Drinks', 'invalid'])('category lookup validates %s', async (category) => {
  const result = await api()
    .post('/get-products-by-category')
    .set('Cookie', cookie())
    .send({ category })
    .expect(200);
  expect(result.body).toEqual(
    category === 'invalid' ? { success: false } : { success: true, products: [] },
  );
  if (category === 'invalid') expect(models.products.find).not.toHaveBeenCalled();
  else expect(models.products.find).toHaveBeenCalledWith({ category });
});

for (const [route, collection, field] of [
  ['total-products', 'products', 'productsCount'],
  ['total-orders', 'orders', 'ordersCount'],
] as const) {
  test.each([0, 7])(`${route} returns count %i`, async (count) => {
    models[collection].countDocuments.mockResolvedValue(count);
    expect((await api().get(`/${route}`).set('Cookie', cookie()).expect(200)).body).toEqual({
      success: true,
      [field]: count,
    });
  });
}

test('logout clears the session cookie', async () => {
  const result = await api().get('/logout').set('Cookie', cookie()).expect(200);
  expect(result.body).toEqual({ success: true });
  expect(result.headers['set-cookie'][0]).toMatch(/SESSIONID=;.*Expires=Thu, 01 Jan 1970/);
});

for (const [method, route, allowedRole] of [
  ['post', 'add-product', 1],
  ['post', 'edit-product', 1],
  ['get', 'get-last-order', 0],
  ['get', 'total-orders', 0],
  ['get', 'total-products', 0],
  ['post', 'create-cart', 0],
  ['post', 'update-cart', 0],
  ['get', 'get-cart', 0],
]) {
  test(`${route} rejects the wrong role through the Nest guard`, async () => {
    const result = await api()
      [method](`/${route}`)
      .set('Cookie', cookie(allowedRole === 1 ? customer : admin))
      .send({})
      .expect(403);
    expect(result.body).toEqual({ success: false });
    expect(models.products.create).not.toHaveBeenCalled();
    expect(models.carts.findOneAndUpdate).not.toHaveBeenCalled();
  });
}

test.each([
  ['login', 20],
  ['sign-up', 5],
] as const)(
  '%s limits requests before accessing the database and allows requests after expiry',
  async (route, limit) => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now());
    try {
      for (let attempt = 0; attempt < limit; attempt++) {
        await api()
          .post(`/${route}`)
          .send({})
          .expect(route === 'login' ? 401 : 200);
      }
      models.users.findOne.mockClear();
      models.users.create.mockClear();
      const blocked = await api()
        .post(`/${route}`)
        .set('X-Forwarded-For', '203.0.113.42')
        .send({ username: customer.username, password: 'password123' })
        .expect(429);
      expect(blocked.body.success).toBe(false);
      expect(blocked.headers['retry-after']).toBe('900');
      expect(models.users.findOne).not.toHaveBeenCalled();
      expect(models.users.create).not.toHaveBeenCalled();
      await api()
        .post(route === 'login' ? '/sign-up' : '/login')
        .send({})
        .expect(route === 'login' ? 200 : 401);
      clock.mockReturnValue(Date.now() + 15 * 60 * 1000);
      await api()
        .post(`/${route}`)
        .send({})
        .expect(route === 'login' ? 401 : 200);
    } finally {
      clock.mockRestore();
    }
  },
);

test('authentication rate limits are independent for different peer addresses', () => {
  const context = (address: string) => ({
    getHandler: () => ({ name: 'login' }),
    switchToHttp: () => ({
      getRequest: () => ({ socket: { remoteAddress: address } }),
      getResponse: () => ({ setHeader: jest.fn() }),
    }),
  });
  for (let i = 0; i < 20; i++) authRateLimiter.canActivate(context('192.0.2.1'));
  expect(() => authRateLimiter.canActivate(context('192.0.2.1'))).toThrow();
  expect(authRateLimiter.canActivate(context('192.0.2.2'))).toBe(true);
});

test('login sets an HTTP-only cookie without exposing the password hash in its payload', async () => {
  models.users.findOne.mockResolvedValue({
    ...customer,
    password: await bcrypt.hash('password123', 4),
  });
  const result = await api()
    .post('/login')
    .send({ username: customer.username, password: 'password123' })
    .expect(200);
  expect(result.body).toEqual({
    success: true,
    role: 0,
    name: 'John Smith',
    user: customer._id,
    isReturning: true,
  });
  expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
  const token = result.headers['set-cookie'][0].split(';')[0].slice('SESSIONID='.length);
  expect(jwt.verify(token, key)).toMatchObject({ sub: customer._id });
  expect(jwt.decode(token)).not.toHaveProperty('data');
});

test.each(['production', 'development', 'test', undefined])(
  'login sets Secure only in production (NODE_ENV=%s)',
  async (environment) => {
    const previousEnvironment = process.env['NODE_ENV'];
    try {
      if (environment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = environment;
      }
      models.users.findOne.mockResolvedValue({
        ...customer,
        password: await bcrypt.hash('password123', 4),
      });
      const result = await api()
        .post('/login')
        .send({ username: customer.username, password: 'password123' })
        .expect(200);
      expect(result.body.success).toBe(true);
      const sessionCookie = result.headers['set-cookie'][0];
      expect(sessionCookie.includes('; Secure')).toBe(environment === 'production');
      expect(sessionCookie).toContain('; HttpOnly');
      expect(sessionCookie).toContain('; SameSite=Lax');
    } finally {
      if (previousEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousEnvironment;
      }
    }
  },
);

test.each([false, true, undefined])(
  'login distinguishes first and returning sessions and preserves the greeting on reconnect (%s)',
  async (hasLoggedIn) => {
    models.users.findOne.mockResolvedValue({
      ...customer,
      password: await bcrypt.hash('password123', 4),
    });
    models.users.findOneAndUpdate.mockResolvedValue({ ...customer, has_logged_in: hasLoggedIn });
    const login = await api()
      .post('/login')
      .send({ username: customer.username, password: 'password123' })
      .expect(200);
    expect(login.body.isReturning).toBe(hasLoggedIn !== false);
    expect(models.users.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: customer._id },
      { $set: { has_logged_in: true } },
      { returnDocument: 'before' },
    );
    const sessionCookie = login.headers['set-cookie'][0].split(';')[0];
    const reconnect = await api().get('/reconect').set('Cookie', sessionCookie).expect(200);
    expect(reconnect.body.isReturning).toBe(hasLoggedIn !== false);
  },
);

test('login rejects incorrect credentials and invalid input', async () => {
  models.users.findOne.mockResolvedValue({
    ...customer,
    password: await bcrypt.hash('password123', 4),
  });
  for (const body of [
    { username: customer.username, password: 'wrongpass' },
    { username: 'invalid', password: 'short' },
  ]) {
    const result = await api().post('/login').send(body).expect(401);
    expect(result.body).toEqual({ success: false });
    expect(result.headers['set-cookie']).toBeUndefined();
  }
});

test('signup hashes the password and forces the customer role', async () => {
  const result = await api()
    .post('/sign-up')
    .send({
      id: '123456789',
      firstName: 'John',
      lastName: 'Smith',
      email: customer.username,
      pass: 'password123',
      city: 'Tel Aviv',
      street: 'Ha Masger',
      role: 1,
    })
    .expect(200);
  expect(result.body).toEqual({ created: true });
  const saved = models.users.create.mock.calls[0][0];
  expect(saved.role).toBe(0);
  expect(saved.has_logged_in).toBe(false);
  expect(await bcrypt.compare('password123', saved.password)).toBe(true);
});

test.each([
  {
    firstName: 'Anne-Marie',
    lastName: "O'Connor",
    city: 'Saint-Étienne',
    street: '12 O’Connell St., #4/2',
  },
  { firstName: 'יוסף', lastName: 'כהן', city: 'תל אביב', street: 'דרך בן-גוריון 10' },
  { firstName: '李', lastName: '王', city: '北京', street: '北京市东路8号' },
  { firstName: 'Jose\u0301', lastName: 'silva', city: 'São Paulo', street: 'Rua São João 1' },
])('signup accepts international details: %j', async (details) => {
  const result = await api()
    .post('/sign-up')
    .send({
      id: '123456789',
      email: customer.username,
      pass: 'password123',
      ...details,
    })
    .expect(200);
  expect(result.body).toEqual({ created: true });
  expect(models.users.create).toHaveBeenCalledWith(
    expect.objectContaining({
      name: { first_name: details.firstName, last_name: details.lastName },
      address: { city: details.city, street: details.street },
    }),
  );
});

test.each([
  { firstName: ' ' },
  { lastName: '123' },
  { city: '<script>' },
  { street: '---' },
  { street: 'Main\nStreet' },
  { firstName: 'A'.repeat(151) },
  { street: 'A'.repeat(151) },
])('signup rejects invalid details: %j', async (details) => {
  const result = await api()
    .post('/sign-up')
    .send({
      id: '123456789',
      email: customer.username,
      pass: 'password123',
      firstName: 'John',
      lastName: 'Smith',
      city: 'Tel Aviv',
      street: 'Main 1',
      ...details,
    })
    .expect(200);
  expect(result.body.created).toBe(false);
  expect(models.users.create).not.toHaveBeenCalled();
});

test('signup rejects invalid input without writing to the database', async () => {
  expect((await api().post('/sign-up').send({}).expect(200)).body.created).toBe(false);
  expect(models.users.create).not.toHaveBeenCalled();
});

test('reconnect preserves the existing response shape', async () => {
  expect((await api().get('/reconect').set('Cookie', cookie()).expect(200)).body).toEqual({
    success: true,
    role: 0,
    name: customer.name,
    user: customer._id,
    isReturning: true,
  });
});

test('accepts existing legacy JWT sessions', async () => {
  const token = jwt.sign({ data: JSON.stringify(customer) }, key, { expiresIn: '1h' });
  expect(
    (await api().get('/reconect').set('Cookie', `SESSIONID=${token}`).expect(200)).body.success,
  ).toBe(true);
});

test('search accepts the frontend product field and escapes regex characters', async () => {
  await api()
    .post('/find-product')
    .set('Cookie', cookie())
    .send({ product: 'Juice (1L)' })
    .expect(200);
  const expression = models.products.find.mock.calls[0][0].name;
  expect(expression.test('Juice (1L)')).toBe(true);
  expect(expression.test('Juice 1L')).toBe(false);
});

test.each(['0.00', '10.99', '001.25', 10.99])('admin can save price %j', async (price) => {
  const response = await api()
    .post('/add-product')
    .set('Cookie', cookie(admin))
    .send({
      name: 'Juice',
      category: 'Wine & Drinks',
      price,
    })
    .expect(200);
  expect(response.body.success).toBe(true);
  expect(models.products.create).toHaveBeenCalledWith(
    expect.objectContaining({ price: Number(price) }),
  );
});

test.each([
  '',
  '10',
  '1.1',
  '-1.00',
  '1e2',
  '1.00\n',
  '1.2.00',
  '١.٠٠',
  null,
  {},
  '9'.repeat(10000) + '.00',
  '9007199254740992.00',
])('admin rejects invalid price %j without writing', async (price) => {
  const response = await api()
    .post('/add-product')
    .set('Cookie', cookie(admin))
    .send({
      name: 'Juice',
      category: 'Wine & Drinks',
      price,
    })
    .expect(200);
  expect(response.body.success).toBe(false);
  expect(models.products.create).not.toHaveBeenCalled();
});

test('admin can add a valid product', async () => {
  const body = { name: 'Juice', category: 'Wine & Drinks', price: '10.00', image: 'juice.png' };
  expect(
    (await api().post('/add-product').set('Cookie', cookie(admin)).send(body).expect(200)).body,
  ).toEqual({ success: true });
  expect(models.products.create).toHaveBeenCalledWith({ ...body, price: Number(body.price) });
});

test('admin can edit a product', async () => {
  models.products.findByIdAndUpdate.mockResolvedValue({ _id: customer._id });
  expect(
    (
      await api()
        .post('/edit-product')
        .set('Cookie', cookie(admin))
        .send({
          id: customer._id,
          name: 'Juice',
          category: 'Wine & Drinks',
          price: '10.00',
          image: 'juice.png',
        })
        .expect(200)
    ).body,
  ).toEqual({ success: true });
});

test('cart updates enforce ownership and open status', async () => {
  models.carts.findOneAndUpdate.mockResolvedValue(null);
  const result = await api()
    .post('/update-cart')
    .set('Cookie', cookie())
    .send({ id: customer._id, products: [] })
    .expect(200);
  expect(result.body).toEqual({ success: false });
  expect(models.carts.findOneAndUpdate).toHaveBeenCalledWith(
    { _id: customer._id, user_id: customer.id, status: 1 },
    { $set: { products: [] } },
  );
});

test('creates and retrieves an open cart using the existing user id', async () => {
  models.carts.create.mockResolvedValue({ _id: 'cart1', created_at: '2026-01-01' });
  expect(
    (await api().post('/create-cart').set('Cookie', cookie()).send({ products: [] }).expect(200))
      .body,
  ).toEqual({ success: true, id: 'cart1', date: '2026-01-01', products: [] });
  models.carts.findOne.mockResolvedValue({ _id: 'cart1', products: [], created_at: '2026-01-01' });
  expect((await api().get('/get-cart').set('Cookie', cookie()).expect(200)).body).toEqual({
    success: true,
    cart: { id: 'cart1', products: [], created: '2026-01-01' },
  });
});

test('a concurrent duplicate cart insert returns the normal failure response', async () => {
  const { MongoServerError } = require('mongoose').mongo;
  models.carts.create.mockRejectedValue(
    new MongoServerError({ code: 11000, message: 'duplicate key' }),
  );
  expect(
    (await api().post('/create-cart').set('Cookie', cookie()).send({ products: [] }).expect(200))
      .body,
  ).toEqual({ success: false });
});

test('order history returns a response even when no orders exist', async () => {
  const sort = jest.fn<(...args: unknown[]) => Promise<null>>().mockResolvedValue(null);
  models.orders.findOne.mockReturnValue({ sort });
  expect((await api().get('/get-last-order').set('Cookie', cookie()).expect(200)).body).toEqual({
    success: true,
  });
  expect(models.orders.findOne).toHaveBeenCalledWith({ user_id: customer.id });
  expect(sort).toHaveBeenCalledWith({ _id: -1 });
});

describe.each(['create-cart', 'update-cart'])('%s validates cart contents', (route) => {
  const productId = '507f1f77bcf86cd799439013';
  const item = { id: productId, count: 2, price: -100, extra: 'discard' };
  const send = (products: unknown) =>
    api().post(`/${route}`).set('Cookie', cookie()).send({ id: customer._id, products });

  test.each(
    [
      null,
      {},
      [null],
      ['invalid'],
      [{ ...item, id: 'invalid' }],
      ...[0, -1, 1.5, '2', null, Number.MAX_SAFE_INTEGER + 1].map((count) => [{ ...item, count }]),
      [{ id: productId, quantity: 2 }],
      [item, { ...item, id: productId.toUpperCase() }],
    ].map((products) => [products]),
  )('rejects malformed items without writing (%j)', async (products) => {
    expect((await send(products).expect(200)).body).toEqual({ success: false });
    expect(models.carts.create).not.toHaveBeenCalled();
    expect(models.carts.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('rejects nonexistent products without writing', async () => {
    expect((await send([item]).expect(200)).body).toEqual({ success: false });
    expect(models.carts.create).not.toHaveBeenCalled();
    expect(models.carts.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('persists and returns catalog prices, discarding client prices and extra fields', async () => {
    models.products.find.mockResolvedValue([{ _id: productId, price: 4.5 }]);
    models.carts.create.mockResolvedValue({ _id: 'cart1' });
    models.carts.findOneAndUpdate.mockResolvedValue({ _id: customer._id });
    const products = [{ id: productId, count: 2, price: 4.5 }];
    expect((await send([item]).expect(200)).body).toMatchObject({ success: true, products });
    if (route === 'create-cart')
      expect(models.carts.create.mock.calls[0][0].products).toEqual(products);
    else expect(models.carts.findOneAndUpdate.mock.calls[0][1]).toEqual({ $set: { products } });
  });
});

test('unknown endpoints return 404', async () => {
  await api().get('/unknown').expect(404);
});
