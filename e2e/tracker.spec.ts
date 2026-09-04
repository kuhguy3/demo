import { test, expect } from '@playwright/test';

test.describe('Bet Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tracker/');
    // Start each test from a clean slate — tracker data is per-origin localStorage.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('add, filter, and delete a bet', async ({ page }) => {
    await page.getByLabel('Selection').fill('Team A to win');
    await page.getByLabel('Decimal odds').fill('2.00');
    await page.getByLabel('Stake').fill('25');
    await page.getByRole('button', { name: /^add bet$/i }).click();

    await expect(page.getByText('Team A to win')).toBeVisible();

    // Settle it as a win and confirm profit shows.
    await page.getByLabel('Status', { exact: true }).selectOption('won');
    await expect(page.getByText('+$25.00').first()).toBeVisible();

    // Delete it.
    await page.getByRole('button', { name: /delete bet team a to win/i }).click();
    await expect(page.getByText('Team A to win')).not.toBeVisible();
  });

  test('export produces a CSV download', async ({ page }) => {
    await page.getByLabel('Selection').fill('Export test');
    await page.getByLabel('Decimal odds').fill('1.91');
    await page.getByLabel('Stake').fill('10');
    await page.getByRole('button', { name: /^add bet$/i }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('betlab-bets.csv');
  });

  test('delete all wipes stored data after confirmation', async ({ page }) => {
    await page.getByLabel('Selection').fill('To be wiped');
    await page.getByLabel('Decimal odds').fill('2.00');
    await page.getByLabel('Stake').fill('10');
    await page.getByRole('button', { name: /^add bet$/i }).click();
    await expect(page.getByText('To be wiped')).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /delete all/i }).click();

    await expect(page.getByText('To be wiped')).not.toBeVisible();
    await expect(page.getByText(/no bets yet/i)).toBeVisible();
  });

  test('closing odds entered inline persist across reload', async ({ page }) => {
    await page.getByLabel('Selection').fill('CLV test');
    await page.getByLabel('Decimal odds').fill('2.00');
    await page.getByLabel('Stake').fill('10');
    await page.getByRole('button', { name: /^add bet$/i }).click();
    await expect(page.getByText('CLV test')).toBeVisible();

    await page.getByLabel('Closing odds').fill('1.90');
    await page.getByLabel('Closing odds').blur();

    await page.reload();
    await expect(page.getByLabel('Closing odds')).toHaveValue('1.9');
  });

  test.describe('Calibration & CLV', () => {
    test('shows a friendly message before enough bets are logged', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /calibration.*clv/i })).toBeVisible();
      await expect(page.getByText(/log at least 10 settled bets/i)).toBeVisible();
    });

    test('shows a bucket table once enough settled, estimated bets exist', async ({ page }) => {
      await page.evaluate(() => {
        const bets = Array.from({ length: 10 }, (_, i) => ({
          id: `bet-${i}`,
          createdAt: new Date(2024, 0, i + 1).toISOString(),
          label: `Calibration bet ${i}`,
          oddsDecimal: 2,
          format: 'decimal',
          rawOdds: '2.00',
          estimatedProb: 0.6,
          stake: 10,
          status: i < 6 ? 'won' : 'lost',
        }));
        localStorage.setItem(
          'betlab.v1.tracker',
          JSON.stringify({
            meta: { schemaVersion: 1, startingBankroll: 1000, currency: 'USD', createdAt: new Date().toISOString() },
            bets,
          }),
        );
      });
      await page.reload();

      await expect(page.getByText(/log at least 10 settled bets/i)).not.toBeVisible();
      await expect(page.getByText('Predicted avg')).toBeVisible();
      await expect(page.getByRole('cell', { name: '60.00%' }).first()).toBeVisible();
    });
  });
});
