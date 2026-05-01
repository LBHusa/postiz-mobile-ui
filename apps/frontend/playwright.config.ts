import { defineConfig, devices } from '@playwright/test';
import { STORAGE_STATE_PATH } from './tests/auth-setup';

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./tests/auth-setup'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    storageState: STORAGE_STATE_PATH,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone-14-pro',
      use: { ...devices['iPhone 14 Pro'] },
    },
  ],
});
