import { test, expect } from '@playwright/test'

test.describe('signage flow', () => {
  test('create outlet, create playlist, schedule it', async ({ page }) => {
    // Create outlet
    await page.goto('/outlets')
    await page.fill('input[name="name"]', 'E2E Test Outlet')
    await page.fill('input[name="region"]', 'Test')
    await page.click('button[type="submit"]')
    await expect(page.getByText('E2E Test Outlet')).toBeVisible({ timeout: 5_000 })

    // Create playlist
    await page.goto('/playlists')
    await page.fill('input[name="name"]', 'E2E Playlist')
    await page.click('button[type="submit"]')
    await expect(page.getByText('E2E Playlist')).toBeVisible({ timeout: 5_000 })
  })
})
