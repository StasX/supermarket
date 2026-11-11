const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const { load, plain, route, response } = require('./helpers.cjs');

test('product listing exposes public product fields and maps _id to id', () => {
    const product = { _id: 'p1', name: 'Juice', price: '10.00', image: 'juice.png', category: 'Wine & Drinks', internal: 'hidden' };
    const endpoint = route('get-all-products', {
        find(query, callback) {
            assert.deepEqual(plain(query), {});
            callback(null, [product]);
        }
    });
    assert.equal(endpoint.method, 'get');
    assert.equal(endpoint.url, '/');
    const res = response();
    endpoint.handlers.at(-1)({}, res);
    assert.deepEqual(res.body, { success: true, products: [{ id: 'p1', name: 'Juice', price: '10.00', image: 'juice.png', category: 'Wine & Drinks' }] });
});

test('product listing handles an empty collection', () => {
    const endpoint = route('get-all-products', { find: (_query, cb) => cb(null, []) });
    const res = response();
    endpoint.handlers.at(-1)({}, res);
    assert.deepEqual(res.body, { success: true, products: [] });
});

for (const invalid of [false, true]) {
    test(`category lookup ${invalid ? 'rejects validation errors before querying' : 'queries the requested category'}`, () => {
        let queried = false;
        const products = [{ _id: 'p1', category: 'Wine & Drinks' }];
        const endpoint = route('get-products-by-category', {
            find(query, cb) {
                queried = true;
                assert.deepEqual(plain(query), { category: 'Wine & Drinks' });
                cb(null, products);
            }
        });
        const req = {
            body: { category: 'Wine & Drinks' },
            checkBody(field) {
                assert.equal(field, 'category');
                return { isIn(choices) { assert.ok(choices.includes('Wine & Drinks')); } };
            },
            validationErrors: () => invalid ? [{ msg: 'invalid category' }] : false
        };
        const res = response();
        endpoint.handlers.at(-1)(req, res);
        assert.equal(queried, !invalid);
        assert.deepEqual(res.body, invalid ? { success: false } : { success: true, products });
    });
}

for (const [filename, field] of [['tototal-products', 'productsCount'], ['tototal-orders', 'ordersCount']]) {
    for (const count of [0, 7]) {
        test(`${filename} returns count ${count}`, () => {
            const endpoint = route(filename, { count(query, cb) { assert.deepEqual(plain(query), {}); cb(null, count); } });
            const res = response();
            endpoint.handlers.at(-1)({}, res);
            assert.deepEqual(res.body, { success: true, [field]: count });
        });
    }
}

test('logout clears the session cookie', () => {
    const res = response();
    route('logout').handlers.at(-1)({}, res);
    assert.deepEqual(res.cleared, ['SESSIONID']);
    assert.deepEqual(res.body, { success: true });
});

const permission = load('middlewares/permitionValidationMiddleware.js');
for (const [url, allowedRole] of [
    ['/add-product', 1], ['/edit-product', 1], ['/get-last-order', 0],
    ['/get-opened-cart', 0], ['/total-orders', 0], ['/total-products', 0],
    ['/create-cart', 0], ['/update-cart', 0], ['/get-cart', 0]
]) {
    test(`permissions allow only role ${allowedRole} for ${url}`, () => {
        for (const role of [0, 1, 2, undefined]) {
            let nextCalled = false;
            const res = response();
            permission({ originalUrl: url, user_data: { role } }, res, () => { nextCalled = true; });
            assert.equal(nextCalled, role === allowedRole);
            assert.deepEqual(res.body, role === allowedRole ? undefined : { success: false });
        }
    });
}

test('permissions reject unknown routes', () => {
    const res = response();
    permission({ originalUrl: '/unknown', user_data: { role: 1 } }, res, () => assert.fail('must reject'));
    assert.deepEqual(res.body, { success: false });
});
