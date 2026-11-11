const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { once } = require('node:events');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../dist/models/User');
const Product = require('../dist/models/Product');
const Cart = require('../dist/models/Cart');
const Order = require('../dist/models/Order');

let server, base, temporaryDirectory, customerCookie, adminCookie;
let logs = '';
const password = 'Integration123!';
const registration = {
    firstName: 'Alice', lastName: 'Shopper', email: 'alice@example.com',
    pass: password, id: '123456789', city: 'London', street: 'High Street'
};

async function request(route, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(base + route, {
        method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(5000)
    });
    assert.equal(response.status, 200, route);
    return { body: await response.json(), cookie: response.headers.get('set-cookie') };
}

before(async () => {
    const uri = process.env.MONGODB_URI;
    // This suite clears its database. Refuse the application's normal database.
    assert.ok(uri && /^mongodb:\/\/[^/]+\/shop_integration(?:\?|$)/.test(uri),
        'MONGODB_URI must point to a dedicated shop_integration database');
    await mongoose.connect(uri);
    await Promise.all([User.init(), Product.init(), Cart.init(), Order.init()]);
    await Promise.all([User.deleteMany({}), Product.deleteMany({}), Cart.deleteMany({}), Order.deleteMany({})]);
    await User.create({ id: 987654321, username: 'admin@example.com',
        password: bcrypt.hashSync(password, bcrypt.genSaltSync(4)),
        name: { first_name: 'Admin', last_name: 'User' }, role: 1 });
    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'shop-integration-'));
    const keyPath = path.join(temporaryDirectory, 'key.pem');
    writeFileSync(keyPath, require('node:crypto').randomBytes(48).toString('hex'));
    const portProbe = net.createServer();
    portProbe.listen(0, '127.0.0.1');
    await once(portProbe, 'listening');
    const port = portProbe.address().port;
    await new Promise(resolve => portProbe.close(resolve));
    base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['dist/main.js'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: String(port), JWT_KEY_PATH: keyPath },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.on('data', data => { logs += data; });
    server.stderr.on('data', data => { logs += data; });
    for (let attempt = 0; attempt < 100; attempt++) {
        assert.equal(server.exitCode, null, logs);
        try {
            const response = await fetch(base, { signal: AbortSignal.timeout(500) });
            if (response.ok) return;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Application did not start: ${logs}`);
}, { timeout: 30000 });

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
    for (const route of ['/get-all-products', '/get-cart', '/reconect', '/total-products']) {
        assert.deepEqual((await request(route)).body, { success: false });
    }
});

test('signup persists a hashed password, rejects duplicates, and login creates a session', async () => {
    assert.deepEqual((await request('/sign-up', { method: 'POST', body: registration })).body, { created: true });
    const user = await User.findOne({ username: registration.email });
    assert.notEqual(user.password, password);
    assert.ok(bcrypt.compareSync(password, user.password));
    assert.equal(user.role, 0);
    assert.equal((await request('/sign-up', { method: 'POST', body: registration })).body.created, false);
    for (const credentials of [
        { username: 'invalid', password: 'short' },
        { username: registration.email, password: 'Incorrect123' },
        { username: 'missing@example.com', password }
    ]) {
        assert.deepEqual((await request('/login', { method: 'POST', body: credentials })).body, { success: false });
    }
    for (const [username, role] of [[registration.email, 0], ['admin@example.com', 1]]) {
        const login = await request('/login', { method: 'POST', body: { username, password } });
        assert.equal(login.body.success, true);
        assert.equal(login.body.role, role);
        assert.match(login.cookie, /HttpOnly/i);
        const cookie = login.cookie.split(';')[0];
        if (role === 0) customerCookie = cookie;
        else adminCookie = cookie;
        const session = await request('/reconect', { cookie });
        assert.equal(session.body.user, login.body.user);
        assert.equal(session.body.role, role);
    }
});

test('admin product writes persist, validate input, and enforce customer permissions', async () => {
    const product = { name: 'Test Milk', category: 'Milk & Eggs', price: '4.50', image: 'test-milk.png' };
    const add = (body, cookie = adminCookie) => request('/add-product', { method: 'POST', body, cookie });
    assert.equal((await add(product, customerCookie)).body.success, false);
    assert.equal(await Product.countDocuments({}), 0);
    assert.equal((await add({ ...product, category: 'Invalid' })).body.success, false);
    assert.equal((await add({ ...product, price: '4' })).body.success, false);
    assert.equal((await add(product)).body.success, true);
    assert.equal((await add(product)).body.success, false);
    const stored = await Product.findOne({ name: product.name });
    assert.equal(stored.price, 4.5);
    const edit = { ...product, id: String(stored._id), price: '5.25' };
    assert.equal((await request('/edit-product', { method: 'POST', body: edit, cookie: customerCookie })).body.success, false);
    assert.equal((await request('/edit-product', { method: 'POST', body: edit, cookie: adminCookie })).body.success, true);
    assert.equal((await Product.findById(stored._id)).price, 5.25);
    const catalog = (await request('/get-all-products', { cookie: customerCookie })).body;
    assert.equal(catalog.success, true);
    assert.deepEqual(catalog.products, [{ id: String(stored._id), ...product, price: 5.25 }]);
    const category = await request('/get-products-by-category', {
        method: 'POST', cookie: customerCookie, body: { category: product.category }
    });
    assert.equal(category.body.products.length, 1);
    assert.equal((await request('/total-products', { cookie: customerCookie })).body.productsCount, 1);
});

test('customer cart creation, duplicate rejection, update and retrieval use MongoDB', async () => {
    assert.deepEqual((await request('/get-cart', { cookie: customerCookie })).body, { success: true });
    const create = cookie => request('/create-cart', { method: 'POST', body: { products: [] }, cookie });
    assert.equal((await create(adminCookie)).body.success, false);
    const created = (await create(customerCookie)).body;
    assert.equal(created.success, true);
    assert.ok(created.id);
    assert.ok(created.date);
    assert.equal((await create(customerCookie)).body.success, false);
    assert.equal(await Cart.countDocuments({}), 1);
    const product = await Product.findOne({});
    const products = [{ id: String(product._id), count: 2, price: product.price }];
    assert.equal((await request('/update-cart', {
        method: 'POST', cookie: customerCookie, body: { products }
    })).body.success, false);
    assert.equal((await request('/update-cart', {
        method: 'POST', cookie: customerCookie, body: { id: created.id, products: [{ ...products[0], price: -100 }] }
    })).body.success, true);
    const cart = (await request('/get-cart', { cookie: customerCookie })).body.cart;
    assert.equal(cart.id, created.id);
    assert.deepEqual(cart.products, products);
    assert.deepEqual((await Cart.findById(created.id)).toObject().products, products);
    assert.equal((await request('/total-orders', { cookie: customerCookie })).body.ordersCount, 0);
});

test('logout expires the browser session cookie', async () => {
    const logout = await request('/logout', { cookie: customerCookie });
    assert.equal(logout.body.success, true);
    assert.match(logout.cookie, /SESSIONID=;/);
    assert.match(logout.cookie, /Expires=Thu, 01 Jan 1970/);
    assert.equal((await request('/reconect')).body.success, false);
});

