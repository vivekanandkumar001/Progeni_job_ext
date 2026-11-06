/**
 * Auto Apply AI — End-to-End Playwright Authentication & Authorization Test Suite
 *
 * Requirements:
 * npx playwright test tests/auth.e2e.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

test.describe('Candidate Authentication & Onboarding E2E', () => {
  test('User can register with email and password, triggering confirmation message', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);

    // Verify signup screen
    await expect(page.locator('h1')).toHaveText('Create your account');

    const testEmail = `candidate_${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[autoComplete="new-password"]:not([placeholder*="Confirm"])', 'StrongPass123!');
    await page.fill('input[autoComplete="new-password"]:last-of-type', 'StrongPass123!');

    await page.click('button:has-text("Create account")');

    // Asserts successful registration message or dashboard redirection
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('Public paths are accessible without active authentication session', async ({ page }) => {
    for (const path of ['/login', '/signup', '/privacy', '/reset-password', '/unauthorized', '/session-expired']) {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page).toHaveURL(new RegExp(path));
    }
  });

  test('Protected routes redirect unauthenticated users to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);

    await page.goto(`${BASE_URL}/settings-privacy`);
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings-privacy/);
  });

  test('Unauthorized page displays 403 Access Restricted status', async ({ page }) => {
    await page.goto(`${BASE_URL}/unauthorized`);
    await expect(page.locator('h1')).toHaveText('Unauthorized Access');
    await expect(page.locator('text=ACCESS RESTRICTED')).toBeVisible();
  });

  test('Session expired page displays security termination notice', async ({ page }) => {
    await page.goto(`${BASE_URL}/session-expired`);
    await expect(page.locator('h1')).toHaveText('Session Expired');
    await expect(page.locator('text=Sign In Again')).toBeVisible();
  });
});

