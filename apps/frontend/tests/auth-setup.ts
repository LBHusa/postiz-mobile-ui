import { chromium } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4200';
const EMAIL = process.env.PLAYWRIGHT_EMAIL ?? '';
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? '';

export const STORAGE_STATE_PATH = path.join(
  __dirname,
  '..',
  'playwright',
  '.auth',
  'user.json'
);

/**
 * Acquires an authenticated browser session and saves storage state to disk.
 * Run once before the test suite via `globalSetup` in playwright.config.ts.
 *
 * Usage in playwright.config.ts:
 *   globalSetup: './tests/auth-setup.ts'
 *   storageState: './playwright/.auth/user.json'  (in the project config)
 */
async function globalSetup() {
  if (!EMAIL || !PASSWORD) {
    console.warn(
      '[auth-setup] PLAYWRIGHT_EMAIL / PLAYWRIGHT_PASSWORD not set — skipping auth setup. ' +
        'Tests requiring storage state will skip via requireAuth().'
    );
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}/auth/login`);

  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in|einloggen/i }).click();

  await page.waitForURL((url) => !url.pathname.includes('/auth'), {
    timeout: 15_000,
  });

  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}

export default globalSetup;
