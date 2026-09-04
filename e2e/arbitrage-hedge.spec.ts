import { test, expect } from '@playwright/test';

test.describe('Arbitrage calculator', () => {
  test('detects an arbitrage at 2.10/2.05 and shows an allocation', async ({ page }) => {
    await page.goto('/tools/arbitrage/');
    await expect(page.getByText(/exists — guaranteed/i)).toBeVisible();
    await expect(page.getByText(/outcome 1 stake/i)).toBeVisible();
  });

  test('reports none when prices carry a normal vig', async ({ page }) => {
    await page.goto('/tools/arbitrage/');
    await page.getByLabel('Outcome 1 — best price found').fill('1.9');
    await page.getByLabel('Outcome 2 — best price found').fill('1.9');
    await expect(page.getByText(/none at these prices/i)).toBeVisible();
  });
});

test.describe('Hedge calculator', () => {
  test('sizes a hedge stake and shows equalized profit', async ({ page }) => {
    await page.goto('/tools/hedge/');
    await expect(page.getByText('$150.00')).toBeVisible();
    const profits = page.getByText(/^\+\$50\.00$/);
    await expect(profits.first()).toBeVisible();
  });
});
