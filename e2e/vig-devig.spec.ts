import { test, expect } from '@playwright/test';

test.describe('Vig calculator de-vig methods', () => {
  test('switching from proportional to Shin changes the fair probabilities', async ({ page }) => {
    await page.goto('/tools/vig-calculator/');
    await page.getByLabel('Outcome 1 odds').fill('1.4');
    await page.getByLabel('Outcome 2 odds').fill('2.98');

    await expect(page.getByText(/Outcome 1 fair/i)).toBeVisible();
    const proportionalText = await page.locator('text=/Outcome 1 fair/i').locator('..').textContent();

    await page.getByRole('radio', { name: 'Shin' }).click();
    await expect(page.getByText(/insider proportion z/i)).toBeVisible();
    const shinText = await page.locator('text=/Outcome 1 fair/i').locator('..').textContent();

    expect(shinText).not.toBe(proportionalText);
  });
});
