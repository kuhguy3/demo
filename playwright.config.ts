import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Some sandboxed environments only install the full Chromium binary, not the
// headless-shell variant Playwright defaults to for headless runs. If that
// path exists, pin to it explicitly; otherwise leave Playwright's default
// resolution alone (e.g. a normal local/CI install with headless-shell).
const fallbackChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const chromiumPath = existsSync(fallbackChromium) ? fallbackChromium : undefined;

// E2E runs against the actual static export (`out/`) served as production —
// the same artifact that would be deployed — not the dev server.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    // No `-s` (SPA) flag: this is a real multi-page static export, and `-s`
    // would rewrite every route to the homepage's index.html.
    command: 'npm run build && npx serve -l 4173 out',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromiumPath
          ? { executablePath: chromiumPath, args: ['--headless=new'] }
          : {},
      },
    },
    {
      name: 'mobile-390',
      use: {
        ...devices['Pixel 7'],
        launchOptions: chromiumPath
          ? { executablePath: chromiumPath, args: ['--headless=new'] }
          : {},
      },
    },
  ],
});
