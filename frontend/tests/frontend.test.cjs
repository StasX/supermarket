const test = require('node:test');
const assert = require('node:assert/strict');
const { angularScript, plain } = require('./helpers.cjs');

for (const [name, key, valid, invalid] of [
    ['price', 'price', ['0.00', '10.99'], ['', '10', '1.1', '-1.00', 'abc']],
    ['email', 'aEmail', ['j.smith@example.com', 'user123@test.co.il'], ['', 'user', 'user@', '@example.com', 'a b@example.com']]
]) {
    test(`${name} directive validates input and preserves the model value`, () => {
        const definition = angularScript(`directives/${name}Directive.js`)[`${name}Directive`]();
        const validity = {};
        const model = { $parsers: [], $setValidity: (field, value) => { validity[field] = value; } };
        definition.link({}, {}, {}, model);
        assert.equal(definition.require, 'ngModel');
        for (const [values, expected] of [[valid, true], [invalid, false]]) {
            for (const value of values) {
                assert.equal(model.$parsers[0](value), value);
                assert.equal(validity[key], expected, value);
            }
        }
    });
}

test('password confirmation checks the current password', () => {
    const definition = angularScript('directives/confirmDirective.js').confirmDirective();
    const scope = { $parent: { form: { pass: { $modelValue: 'password123' } } } };
    let valid;
    const model = { $parsers: [], $setValidity: (_key, value) => { valid = value; } };
    definition.link(scope, {}, {}, model);
    model.$parsers[0]('password123');
    assert.equal(valid, true);
    model.$parsers[0]('different');
    assert.equal(valid, false);
    scope.$parent.form.pass.$modelValue = 'updated';
    model.$parsers[0]('updated');
    assert.equal(valid, true);
});

for (const [url, title] of [
    ['/login', 'Login to Dragon shop'], ['/sign-up', 'Sign up to Dragon shop'],
    ['/about', 'About us'], ['/info', 'Info'], ['/welcome', 'Welcome to Dragon shop'],
    ['/order', 'Order'], ['/management', 'Product manager'], ['/unknown', 'Dragon shop']
]) {
    test(`page title for ${url}`, () => {
        const element = {};
        const Service = angularScript('services/titlerService.js', { $: selector => {
            assert.equal(selector, 'title'); return [element];
        } }).titlerService;
        new Service().state(url);
        assert.equal(element.text, title);
    });
}

for (const [url, allowed] of [['/about', 0], ['/info', 0], ['/welcome', 0], ['/store', 0], ['/order', 0], ['/management', 1]]) {
    test(`frontend navigation permissions for ${url}`, () => {
        const Service = angularScript('services/permitionService.js').permitionService;
        for (const role of [0, 1]) {
            const destinations = [];
            new Service().check({ userData: { role } }, { current: { url }, go: state => destinations.push(state) }, {});
            assert.deepEqual(destinations, role === allowed ? [] : ['login']);
        }
    });
}

for (const outcome of ['success', 'denied', 'network']) {
    test(`session reconnect handles ${outcome}`, () => {
        const Service = angularScript('services/permitionService.js').permitionService;
        const root = {};
        const destinations = [];
        const http = { get(url) {
            assert.equal(url, '/reconect');
            return { then(ok, fail) {
                if (outcome === 'network') fail();
                else ok({ data: { success: outcome === 'success', role: 0, user: 'u1', name: 'John' } });
            } };
        } };
        new Service().check(root, { go: state => destinations.push(state) }, http);
        assert.deepEqual(destinations, outcome === 'success' ? [] : ['login']);
        assert.deepEqual(root.userData && plain(root.userData), outcome === 'success' ? { role: 0, user: 'u1', name: 'John' } : undefined);
    });
}

for (const outcome of ['success', 'denied', 'network']) {
    test(`logout component handles ${outcome}`, () => {
        const alerts = [];
        const component = angularScript('components/userLogout/userLogout.js', { swal: message => alerts.push(message) }).userLogout;
        const scope = {};
        const root = { userData: { role: 0 } };
        const destinations = [];
        const http = { get(url) {
            assert.equal(url, '/logout');
            return { then(ok, fail) {
                if (outcome === 'network') fail();
                else ok({ data: { success: outcome === 'success' } });
            } };
        } };
        component.controller(scope, http, { go: state => destinations.push(state) }, root);
        scope.logout();
        assert.deepEqual(destinations, outcome === 'success' ? ['login'] : []);
        assert.deepEqual(alerts, outcome === 'success' ? [] : ['Please try again']);
        assert.equal(root.userData === undefined, outcome !== 'network');
    });
}
