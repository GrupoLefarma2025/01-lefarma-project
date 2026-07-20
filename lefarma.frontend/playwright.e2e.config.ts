import { defineConfig, devices } from '@playwright/test';

/**
 * Config E2E dedicada para multi-app-login.
 *
 * MOTIVO: el puerto 5173 está ocupado por OTRO proyecto (core-manager/Core.UI,
 * base '/sisco2-1'), no por lefarma.frontend. playwright.config.ts tiene
 * reuseExistingServer:true y url:5173, por lo que reusaría la app equivocada.
 *
 * Esta config arranca lefarma.frontend (con la refactorización MultiStepLogin,
 * base '/') en un puerto libre (5180) gestionado por el propio Playwright:
 * reuseExistingServer:false => Playwright lo levanta antes de los tests y lo
 * detiene al terminar. No toca los servidores existentes (:5173, :5174).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
