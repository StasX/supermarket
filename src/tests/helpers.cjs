const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the real legacy scripts with explicit dependency boundaries.
function load(relativePath, globals = {}, dependencies = {}) {
    const filename = path.resolve(__dirname, '..', relativePath);
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, exports: module.exports, __dirname: path.dirname(filename),
        require(name) {
            if (Object.hasOwn(dependencies, name)) return dependencies[name];
            if (name === 'path') return path;
            throw new Error(`Unexpected dependency: ${name}`);
        },
        ...globals
    }, { filename });
    return module.exports;
}

// Normalize objects from the VM before comparing them with host objects.
const plain = value => JSON.parse(JSON.stringify(value));

function route(filename, model = {}) {
    const routes = [];
    const router = {};
    for (const method of ['get', 'post']) {
        router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
    }
    const middleware = (_req, _res, next) => next();
    load(`routes/${filename}.js`, {}, {
        express: { Router: () => router }, mongoose: {}, jsonwebtoken: {},
        '../models/Product': model, '../models/Order': model,
        '../middlewares/tokenValidationMiddleware': middleware,
        '../middlewares/permitionValidationMiddleware': middleware
    });
    return routes[0];
}

function response() {
    return {
        body: undefined, cleared: [],
        json(body) { this.body = plain(body); },
        clearCookie(name) { this.cleared.push(name); }
    };
}

function angularScript(filename, globals = {}) {
    const registered = {};
    const app = {};
    for (const kind of ['service', 'directive', 'component']) {
        app[kind] = (name, definition) => { registered[name] = definition; };
    }
    load(`public/app/${filename}`, { app, ...globals });
    return registered;
}

module.exports = { load, plain, route, response, angularScript };
