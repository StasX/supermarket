import { defineConfig } from '@playwright/test';
import process from 'node:process';

export default defineConfig({
  testDir: './e2e', fullyParallel: true, timeout: 30000,
  use: {
    baseURL: process.env['E2E_BASE_URL'] || 'http://localhost:3000',
    channel: process.env['PLAYWRIGHT_CHANNEL'] || 'chrome',
    headless: true, screenshot: 'only-on-failure',
  },
});
