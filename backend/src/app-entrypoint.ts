import './load-env';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createApp } from './main';

const keyPath = process.env['JWT_KEY_PATH'] || '/app/keys/session.key';
process.env['JWT_KEY_PATH'] = keyPath;
try {
  writeFileSync(keyPath, randomBytes(64).toString('hex'), { flag: 'wx', mode: 0o600 });
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
    throw error;
  }
}

createApp()
  .then((app) => app.listen(process.env['PORT'] || 3000, '0.0.0.0'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
