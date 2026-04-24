import { test, expect } from '@playwright/test'
import { collectConsoleErrors, signInAs } from './helpers'

test.describe('smoke — app is not on fire', () => {
  test('home page renders and returns 200', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    const response = await page.goto('/')
    expect(response?.ok(), 'GET / should succeed').toBeTruthy()
    expect(errors, `unexpected console errors: ${errors.join(' | ')}`).toEqual([])
  })

  test('/login form renders', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('admin can sign in and land on the hub', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await signInAs(page, 'admin')
    // After login, admin-role users land on the hub. Assert we're no longer
    // on /login and that *something* admin-shaped renders.
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/admin/i).first()).toBeVisible({ timeout: 10_000 })
    expect(errors).toEqual([])
  })

  test('athlete can sign in and see their dashboard', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await signInAs(page, 'athlete1')
    await expect(page).not.toHaveURL(/\/login/)
    // Athlete1's profile has first_name 'Alex' — should appear somewhere on
    // the post-login view (greeting, profile badge, etc.).
    await expect(page.getByText(/alex/i).first()).toBeVisible({ timeout: 10_000 })
    expect(errors).toEqual([])
  })
})
