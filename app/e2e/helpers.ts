import type { Page } from '@playwright/test'
import { TEST_USERS, type TestUserKey } from './_fixtures/users'

/**
 * Log in via the UI's /login form. Returns once the client has navigated
 * away from /login — test code can then assert against whatever landing page
 * the role-specific router directs the user to.
 */
export async function signInAs(page: Page, userKey: TestUserKey): Promise<void> {
  const user = TEST_USERS[userKey]
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(user.email)
  await page.locator('input[type="password"]').fill(user.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}

/**
 * Collect browser console errors during a test. Call before navigation;
 * the returned array is mutated as the page logs.
 *
 * Ignores warnings and info-level messages — only 'error' severity counts.
 * Also filters noise we don't care about for smoke-test purposes:
 *   - Next.js dev hydration diagnostics
 *   - Favicon 404s
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  const ignorePatterns: RegExp[] = [
    /favicon\.ico/i,
    /hydrat(ion|ed)/i,
    /React DevTools/i,
  ]
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (ignorePatterns.some((rx) => rx.test(text))) return
    errors.push(text)
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}
