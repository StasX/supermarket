const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const plain = value => JSON.parse(JSON.stringify(value));

function angularScript(relativePath, globals = {}) {
    const filename = path.resolve(__dirname, '..', 'src', 'app', relativePath);
    const registered = {};
    const app = {};
    for (const kind of ['service', 'directive', 'component']) {
        app[kind] = (name, definition) => { registered[name] = definition; };
    }
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { app, ...globals }, { filename });
    return registered;
}

module.exports = { plain, angularScript };
