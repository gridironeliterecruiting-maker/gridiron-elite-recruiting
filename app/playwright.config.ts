import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end test configuration for Runway Recruit's self-QA suite.
 *
 * Expected preconditions (Claude runs these before `npm run qa`):
 *   1. Local Supabase stack up via `npm run db:start` (ports 54321-54324).
 *   2. Seed data applied via `npm run db:reset` if the DB is dirty.
 * The Next.js dev server is booted automatically by `webServer` below.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
