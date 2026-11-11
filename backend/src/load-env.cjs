const { loadEnvFile } = require('node:process');
const path = require('node:path');

try {
    loadEnvFile(path.join(__dirname, '..', '..', '.env'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}
