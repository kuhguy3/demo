import { test, expect } from '@playwright/test';

test.describe('Bet Analyzer', () => {
  test('shows a +EV verdict, the math, and restores state from a shared link', async ({ page }) => {
    await page.goto('/analyze/');
    const verdict = page.getByTestId('verdict');

    // Default inputs (2.10 @ 52%) are +EV — verdict should show on load.
    await expect(verdict).toContainText('+EV');

    // Show the math.
    await page.getByRole('button', { name: /show the math/i }).click();
    await expect(page.getByText(/Expected value = stake/i)).toBeVisible();

    // Change the probability to something clearly -EV and check the verdict flips.
    // Two controls share this label (a text field and a slider) — target the textbox.
    const probField = page.getByRole('textbox', { name: 'Your probability estimate' });
    await probField.fill('30');
    await expect(verdict).toContainText('EV');
    await expect(verdict).toContainText(/[−-]EV/);

    // Copy link, then reload with the resulting URL and confirm state restores.
    const url = page.url();
    expect(url).toContain('p=30');

    await page.goto(url);
    await expect(page.getByRole('textbox', { name: 'Your probability estimate' })).toHaveValue('30');
    await expect(page.getByTestId('verdict')).toContainText(/[−-]EV/);
  });

  test('rejects invalid odds and probability with inline errors', async ({ page }) => {
    await page.goto('/analyze/');
    const oddsField = page.getByLabel('Odds offered');
    await oddsField.fill('0.5');
    await expect(page.locator('#main').getByRole('alert')).toContainText(/greater than 1/i);
  });

  test('save to tracker persists a bet locally', async ({ page }) => {
    await page.goto('/analyze/');
    await page.getByRole('button', { name: /save to tracker/i }).click();
    await expect(page.getByRole('button', { name: /saved/i })).toBeVisible();

    await page.goto('/tracker/');
    await expect(page.getByText(/Bet from analyzer/i)).toBeVisible();
  });
});
