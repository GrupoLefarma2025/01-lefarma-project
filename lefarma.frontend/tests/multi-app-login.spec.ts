import { test, expect } from '@playwright/test';

const STEP_CIRCLE = 'div.flex.items-center.justify-center.rounded-full';

test.describe('Render del login MultiStepLogin por app (sin auth)', () => {

  test('RH /rh/login muestra flujo de 2 pasos', async ({ page }) => {
    await page.goto('/rh/login', { waitUntil: 'domcontentloaded' });

    await expect(page.getByPlaceholder(/usuario/i)).toBeVisible();

    await expect(page.locator(STEP_CIRCLE)).toHaveCount(2);

    await expect(page.getByText('Contraseña', { exact: true })).toBeVisible();

    await expect(page.getByText('Ubicación', { exact: true })).toHaveCount(0);
  });

  test('Educación Médica /educacion-medica/login muestra flujo de 2 pasos', async ({ page }) => {
    await page.goto('/educacion-medica/login', { waitUntil: 'domcontentloaded' });

    await expect(page.getByPlaceholder(/usuario/i)).toBeVisible();
    await expect(page.locator(STEP_CIRCLE)).toHaveCount(2);
    await expect(page.getByText('Contraseña', { exact: true })).toBeVisible();
    await expect(page.getByText('Ubicación', { exact: true })).toHaveCount(0);
  });

  test('CxP /cxp/login muestra flujo de 3 pasos con slot Ubicación', async ({ page }) => {
    await page.goto('/cxp/login', { waitUntil: 'domcontentloaded' });

    await expect(page.getByPlaceholder(/usuario/i)).toBeVisible();

    await expect(page.locator(STEP_CIRCLE)).toHaveCount(3);

    await expect(page.getByText('Ubicación', { exact: true })).toBeVisible();
    await expect(page.getByText('Contraseña', { exact: true })).toBeVisible();
  });
});

test.describe('Navegación autenticada: launcher, subtrees y SSO', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'e2e-fake-token');
      localStorage.setItem(
        'user',
        JSON.stringify({
          idUsuario: 1,
          nombre: 'E2E',
          correo: 'e2e@x',
          idEmpresa: 1,
          idSucursal: 1,
          idArea: 1,
        })
      );
    });

    await page.route('http://localhost:5174/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    );
  });

  test('índice raíz autenticado redirige a /hub', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/hub$/);
  });

  test('launcher /hub muestra las 3 apps', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'networkidle' });

    await expect(page.getByRole('link', { name: 'CxP', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Recursos Humanos', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Educación Médica', exact: true })).toBeVisible();
  });

  test('tile de Educación Médica navega a su dashboard', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'networkidle' });

    await page.getByRole('link', { name: 'Educación Médica', exact: true }).click();

    await expect(page).toHaveURL(/\/educacion-medica\/dashboard/);
    await expect(page.getByText('Educación Médica', { exact: true })).toBeVisible();
  });

  test('SSO: sesión única alcanza /rh/dashboard', async ({ page }) => {
    await page.goto('/rh/dashboard');

    await expect(page).toHaveURL(/\/rh\/dashboard/);
    await expect(page.getByText('Recursos Humanos', { exact: true })).toBeVisible();
  });

  test('SSO: /educacion-medica index aterriza en dashboard', async ({ page }) => {
    await page.goto('/educacion-medica');

    await expect(page).toHaveURL(/\/educacion-medica\/dashboard/);
    await expect(page.getByText('Educación Médica', { exact: true })).toBeVisible();
  });

  test('SSO: /cxp index resuelve a /cxp/dashboard (no rebote a login)', async ({ page }) => {
    await page.goto('/cxp');

    await expect(page).toHaveURL(/\/cxp\/dashboard/);
    await expect(page).not.toHaveURL(/\/cxp\/login/);
  });
});
