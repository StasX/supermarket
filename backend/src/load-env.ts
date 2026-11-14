import { loadEnvFile } from 'node:process';
import { join } from 'node:path';

try {
  loadEnvFile(join(__dirname, '..', '..', '.env'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}
