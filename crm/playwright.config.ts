import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { stackKeys } from './scripts/dev-stack/keys.mjs';

const APP_PORT = Number(process.env.E2E_PORT || 3100);
const GATEWAY = `http://127.0.0.1:${process.env.GATEWAY_PORT || 54321}`;
const keys = stackKeys(process.env.JWT_SECRET);
const chromiumPath = [process.env.PW_CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => p && fs.existsSync(p));

/**
 * End-to-end tests run the real production build against the local Supabase-compatible stack
 * (PostgreSQL + PostgREST + auth/storage gateway; `npm run stack:start`). Row-level security,
 * triggers and RPCs are therefore exercised exactly as in Supabase. Realtime websockets are the
 * one thing the local stack does not emulate.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 860 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${APP_PORT}`,
    url: `http://127.0.0.1:${APP_PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: GATEWAY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon,
      SUPABASE_SERVICE_ROLE_KEY: keys.service,
      NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${APP_PORT}`,
      CRON_SECRET: 'e2e-cron-secret',
      EMAIL_PROVIDER: 'console',
    },
  },
});
