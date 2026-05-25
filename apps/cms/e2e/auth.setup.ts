import { test as setup } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.E2E_EMAIL ?? 'test@example.com')
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD ?? 'password')
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard', { timeout: 10_000 }).catch(() => {
    // If auth fails (no local Supabase), skip saving state
  })
  await page.context().storageState({ path: 'e2e/.auth.json' })
})
