require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { HttpAdapterHost } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AppModule } = require('../dist/app.module');
const { MODELS } = require('../dist/database.module');

const customer = { _id: '507f1f77bcf86cd799439011', id: 123456789, username: 'buyer@example.com',
  name: { first_name: 'John', last_name: 'Smith' }, role: 0 };
const admin = { ...customer, _id: '507f1f77bcf86cd799439012', role: 1 };
const key = 'test-only-session-signing-key';
let app, models, directory, oldKeyPath;
const cookie = (user = customer, options = {}) => `SESSIONID=${jwt.sign({}, key, { subject: user._id, expiresIn: '1h', ...options })}`;
const api = () => request(app.getHttpServer());

beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'supermarket-nest-'));
  oldKeyPath = process.env.JWT_KEY_PATH;
  process.env.JWT_KEY_PATH = path.join(directory, 'session.key');
  fs.writeFileSync(process.env.JWT_KEY_PATH, key);
  models = Object.fromEntries(['users', 'products', 'orders', 'carts'].map(name => [name,
    Object.fromEntries(['find', 'findOne', 'create', 'countDocuments', 'findByIdAndUpdate', 'findOneAndUpdate'].map(method => [method, jest.fn()])),
  ]));
  const adapter = new ExpressAdapter();
  const adapterHost = new HttpAdapterHost();
  adapterHost.httpAdapter = adapter;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MODELS).useValue(models)
    .overrideProvider(HttpAdapterHost).useValue(adapterHost).compile();
  app = module.createNestApplication(adapter);
  app.use(cookieParser());
  await app.init();
});

beforeEach(() => {
  jest.resetAllMocks();
  models.users.findOne.mockImplementation(async query => query._id === admin._id ? admin : query._id === customer._id ? customer : null);
  models.products.find.mockResolvedValue([]);
});

afterAll(async () => {
  if (app) await app.close();
  if (oldKeyPath === undefined) delete process.env.JWT_KEY_PATH;
  else process.env.JWT_KEY_PATH = oldKeyPath;
  if (directory) { fs.unlinkSync(path.join(directory, 'session.key')); fs.rmdirSync(directory); }
});

test('serves the unchanged AngularJS application', async () => {
  const response = await api().get('/').expect(200);
  expect(response.text).toContain('ng-app');
  await api().get('/app/app.js').expect(200);
});

test.each([undefined, 'invalid', jwt.sign({}, 'wrong-key'), jwt.sign({ sub: customer._id, exp: 1 }, key)])(
  'rejects missing, malformed, invalid-signature and expired sessions (%s)', async token => {
    const call = api().get('/get-all-products');
    if (token) call.set('Cookie', `SESSIONID=${token}`);
    expect((await call.expect(200)).body).toEqual({ success: false });
    expect(models.products.find).not.toHaveBeenCalled();
  },
);

test('listing maps product fields and excludes internal data', async () => {
  models.products.find.mockResolvedValue([{ _id: 'p1', name: 'Juice', price: 10, image: 'juice.png', category: 'Wine & Drinks', internal: 'hidden' }]);
  expect((await api().get('/get-all-products').set('Cookie', cookie()).expect(200)).body).toEqual({
    success: true, products: [{ id: 'p1', name: 'Juice', price: 10, image: 'juice.png', category: 'Wine & Drinks' }],
  });
});

test('listing handles an empty collection', async () => {
  expect((await api().get('/get-all-products').set('Cookie', cookie())).body).toEqual({ success: true, products: [] });
});

test.each(['Wine & Drinks', 'invalid'])('category lookup validates %s', async category => {
  const result = await api().post('/get-products-by-category').set('Cookie', cookie()).send({ category }).expect(200);
  expect(result.body).toEqual(category === 'invalid' ? { success: false } : { success: true, products: [] });
  if (category === 'invalid') expect(models.products.find).not.toHaveBeenCalled();
  else expect(models.products.find).toHaveBeenCalledWith({ category });
});

for (const [route, collection, field] of [['total-products', 'products', 'productsCount'], ['total-orders', 'orders', 'ordersCount']]) {
  test.each([0, 7])(`${route} returns count %i`, async count => {
    models[collection].countDocuments.mockResolvedValue(count);
    expect((await api().get(`/${route}`).set('Cookie', cookie()).expect(200)).body).toEqual({ success: true, [field]: count });
  });
}

test('logout clears the session cookie', async () => {
  const result = await api().get('/logout').set('Cookie', cookie()).expect(200);
  expect(result.body).toEqual({ success: true });
  expect(result.headers['set-cookie'][0]).toMatch(/SESSIONID=;.*Expires=Thu, 01 Jan 1970/);
});

for (const [method, route, allowedRole] of [
  ['post', 'add-product', 1], ['post', 'edit-product', 1], ['get', 'get-last-order', 0],
  ['get', 'total-orders', 0], ['get', 'total-products', 0], ['post', 'create-cart', 0],
  ['post', 'update-cart', 0], ['get', 'get-cart', 0],
]) {
  test(`${route} rejects the wrong role through the Nest guard`, async () => {
    const result = await api()[method](`/${route}`).set('Cookie', cookie(allowedRole === 1 ? customer : admin)).send({}).expect(200);
    expect(result.body).toEqual({ success: false });
    expect(models.products.create).not.toHaveBeenCalled();
    expect(models.carts.findOneAndUpdate).not.toHaveBeenCalled();
  });
}

test('login sets an HTTP-only cookie without exposing the password hash in its payload', async () => {
  models.users.findOne.mockResolvedValue({ ...customer, password: await bcrypt.hash('password123', 4) });
  const result = await api().post('/login').send({ username: customer.username, password: 'password123' }).expect(200);
  expect(result.body).toEqual({ success: true, role: 0, name: 'John Smith', user: customer._id });
  expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
  const token = result.headers['set-cookie'][0].split(';')[0].slice('SESSIONID='.length);
  expect(jwt.verify(token, key)).toMatchObject({ sub: customer._id });
  expect(jwt.decode(token)).not.toHaveProperty('data');
});

test('login rejects incorrect credentials and invalid input', async () => {
  models.users.findOne.mockResolvedValue({ ...customer, password: await bcrypt.hash('password123', 4) });
  for (const body of [{ username: customer.username, password: 'wrongpass' }, { username: 'invalid', password: 'short' }]) {
    const result = await api().post('/login').send(body).expect(200);
    expect(result.body).toEqual({ success: false });
    expect(result.headers['set-cookie']).toBeUndefined();
  }
});

test('signup hashes the password and forces the customer role', async () => {
  const result = await api().post('/sign-up').send({ id: '123456789', firstName: 'John', lastName: 'Smith',
    email: customer.username, pass: 'password123', city: 'Tel Aviv', street: 'Ha Masger', role: 1 }).expect(200);
  expect(result.body).toEqual({ created: true });
  const saved = models.users.create.mock.calls[0][0];
  expect(saved.role).toBe(0);
  expect(await bcrypt.compare('password123', saved.password)).toBe(true);
});

test('signup rejects invalid input without writing to the database', async () => {
  expect((await api().post('/sign-up').send({}).expect(200)).body.created).toBe(false);
  expect(models.users.create).not.toHaveBeenCalled();
});

test('reconnect preserves the existing response shape', async () => {
  expect((await api().get('/reconect').set('Cookie', cookie()).expect(200)).body).toEqual({
    success: true, role: 0, name: customer.name, user: customer._id,
  });
});

test('accepts existing legacy JWT sessions', async () => {
  const token = jwt.sign({ data: JSON.stringify(customer) }, key, { expiresIn: '1h' });
  expect((await api().get('/reconect').set('Cookie', `SESSIONID=${token}`).expect(200)).body.success).toBe(true);
});

test('search accepts the frontend product field and escapes regex characters', async () => {
  await api().post('/find-product').set('Cookie', cookie()).send({ product: 'Juice (1L)' }).expect(200);
  const expression = models.products.find.mock.calls[0][0].name;
  expect(expression.test('Juice (1L)')).toBe(true);
  expect(expression.test('Juice 1L')).toBe(false);
});

test('admin can add a valid product', async () => {
  const body = { name: 'Juice', category: 'Wine & Drinks', price: '10.00', image: 'juice.png' };
  expect((await api().post('/add-product').set('Cookie', cookie(admin)).send(body).expect(200)).body).toEqual({ success: true });
  expect(models.products.create).toHaveBeenCalledWith(body);
});

test('admin can edit a product', async () => {
  models.products.findByIdAndUpdate.mockResolvedValue({ _id: customer._id });
  expect((await api().post('/edit-product').set('Cookie', cookie(admin)).send({ id: customer._id,
    name: 'Juice', category: 'Wine & Drinks', price: '10.00', image: 'juice.png' }).expect(200)).body).toEqual({ success: true });
});

test('cart updates enforce ownership and open status', async () => {
  models.carts.findOneAndUpdate.mockResolvedValue(null);
  const result = await api().post('/update-cart').set('Cookie', cookie()).send({ id: customer._id, products: [] }).expect(200);
  expect(result.body).toEqual({ success: false });
  expect(models.carts.findOneAndUpdate).toHaveBeenCalledWith({ _id: customer._id, user_id: customer.id, status: 1 }, { $set: { products: [] } });
});

test('creates and retrieves an open cart using the existing user id', async () => {
  models.carts.create.mockResolvedValue({ _id: 'cart1', created_at: '2026-01-01' });
  expect((await api().post('/create-cart').set('Cookie', cookie()).send({ products: [] }).expect(200)).body).toEqual({ success: true, id: 'cart1', date: '2026-01-01' });
  models.carts.findOne.mockResolvedValue({ _id: 'cart1', products: [], created_at: '2026-01-01' });
  expect((await api().get('/get-cart').set('Cookie', cookie()).expect(200)).body).toEqual({ success: true, cart: { id: 'cart1', products: [], created: '2026-01-01' } });
});

test('order history returns a response even when no orders exist', async () => {
  const sort = jest.fn().mockResolvedValue(null);
  models.orders.findOne.mockReturnValue({ sort });
  expect((await api().get('/get-last-order').set('Cookie', cookie()).expect(200)).body).toEqual({ success: true });
  expect(models.orders.findOne).toHaveBeenCalledWith({ user_id: customer.id });
  expect(sort).toHaveBeenCalledWith({ _id: -1 });
});

test('unknown endpoints return 404', async () => {
  await api().get('/unknown').expect(404);
});
