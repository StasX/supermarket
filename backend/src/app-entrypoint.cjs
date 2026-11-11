require('./load-env.cjs');

const fs = require('node:fs');
const crypto = require('node:crypto');

const keyPath = process.env.JWT_KEY_PATH || '/app/keys/session.key';
process.env.JWT_KEY_PATH = keyPath;
try {
    fs.writeFileSync(keyPath, crypto.randomBytes(64).toString('hex'), { flag: 'wx', mode: 0o600 });
} catch (error) {
    if (error.code !== 'EEXIST') throw error;
}

require('./main.js').createApp().then(app => app.listen(process.env.PORT || 3000, '0.0.0.0')).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
