import { test, expect } from '@playwright/test';

test.describe('Simulator', () => {
  test('runs a Monte Carlo simulation off the main thread and shows results', async ({ page }) => {
    await page.goto('/simulator/');
    await page.getByRole('button', { name: /run simulation/i }).click();
    // Button should briefly reflect the worker running (best-effort — worker is fast).
    await expect(page.getByText(/median ending bankroll/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/risk of ruin/i)).toBeVisible();
  });

  test('is reproducible for the same seed via shared link', async ({ page }) => {
    await page.goto('/simulator/?p=60&odds=2&bankroll=1000&bets=100&runs=300&staking=flatPct&fraction=2&seed=999');
    await page.getByRole('button', { name: /run simulation/i }).click();
    await expect(page.getByText(/median ending bankroll/i)).toBeVisible({ timeout: 15_000 });
    const firstText = await page.locator('text=/Median ending bankroll/i').locator('..').textContent();

    await page.goto('/simulator/?p=60&odds=2&bankroll=1000&bets=100&runs=300&staking=flatPct&fraction=2&seed=999');
    await page.getByRole('button', { name: /run simulation/i }).click();
    await expect(page.getByText(/median ending bankroll/i)).toBeVisible({ timeout: 15_000 });
    const secondText = await page.locator('text=/Median ending bankroll/i').locator('..').textContent();

    expect(firstText).toBe(secondText);
  });
});
