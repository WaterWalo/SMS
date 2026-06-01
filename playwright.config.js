// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 15_000,
    expect: { timeout: 8_000 },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: [['html', { open: 'never' }], ['list']],

    use: {
        baseURL: 'http://localhost:4321',
        trace: 'on-first-retry',
    },

    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],

    webServer: {
        // Serve the site root on port 4321 (-c-1 disables caching, --cors for local XHR)
        command: 'npx http-server . -p 4321 -c-1 --cors -s',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
