import { test, expect } from '@playwright/test';

test.describe('Mobile UX (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('analyzer is usable and the result is visible without excessive scrolling', async ({ page }) => {
    await page.goto('/analyze/');
    await expect(page.getByRole('heading', { name: 'Bet Analyzer' })).toBeVisible();
    await expect(page.getByTestId('verdict')).toBeVisible();

    // No horizontal overflow on the page body.
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('mobile nav opens and links work', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /menu/i }).click();
    await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Tools', exact: true }).click();
    await expect(page).toHaveURL(/\/tools\/?$/);
  });
});

test.describe('SEO', () => {
  test('a tool page server-renders its title, canonical, and FAQ structured data', async ({ page }) => {
    const response = await page.goto('/tools/kelly-criterion/');
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/Kelly Criterion/i);
    await expect(page.locator('h1')).toHaveText('Kelly Criterion');

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toContain('/tools/kelly-criterion');

    const ldJson = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ldJson).toBeTruthy();
    const parsed = JSON.parse(ldJson!);
    expect(parsed['@type']).toBe('FAQPage');
  });

  test('sitemap and robots are served', async ({ page, request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain('<urlset');

    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain('Sitemap:');
  });
});
