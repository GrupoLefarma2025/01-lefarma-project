import { test, expect } from '@playwright/test';

/**
 * E2E multi-app.
 *
 * Bloque 1: render del <MultiStepLogin> por app (sesión NO autenticada).
 * Bloque 2: navegación autenticada (launcher /hub, subtrees por-app y SSO).
 *
 * Nota de entorno: correr con `playwright.e2e.config.ts` (base '/',
 * lefarma.frontend en :5180). El :5173 del workspace pertenece a otro proyecto
 * (core-manager), por lo que la config base NO debe reusarlo.
 */

/**
 * Selector de los círculos numerados del <StepIndicator>. El indicador renderiza
 * un círculo por paso, por lo que su conteo coincide con la cantidad de pasos
 * del flujo de login (2 para RH/Educación Médica, 3 para CxP).
 */
const STEP_CIRCLE = 'div.flex.items-center.justify-center.rounded-full';

test.describe('Render del login MultiStepLogin por app (sin auth)', () => {
  // Contexto fresco: sin localStorage => authStore.initialize() deja
  // isAuthenticated=false => la ruta pública de login renderiza <MultiStepLogin>.
  // No se siembra auth en este bloque.

  test('RH /rh/login muestra flujo de 2 pasos', async ({ page }) => {
    await page.goto('/rh/login', { waitUntil: 'domcontentloaded' });

    // El formulario es estático: el campo de usuario confirma que <MultiStepLogin> montó.
    await expect(page.getByPlaceholder(/usuario/i)).toBeVisible();

    // 2 pasos => 2 círculos en el indicador de progreso.
    await expect(page.locator(STEP_CIRCLE)).toHaveCount(2);

    // La etiqueta "Contraseña" (2do paso del flujo global) siempre está presente
    // en el indicador, aun cuando se muestra el paso 1.
    await expect(page.getByText('Contraseña', { exact: true })).toBeVisible();

    // "Ubicación" es exclusiva del flujo de 3 pasos de CxP: aquí no debe existir.
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

    // CxP inyecta el slot step3 (selección de contexto) => flujo de 3 pasos.
    await expect(page.locator(STEP_CIRCLE)).toHaveCount(3);

    // La etiqueta "Ubicación" (step3Label de CxP) es el discriminador clave.
    await expect(page.getByText('Ubicación', { exact: true })).toBeVisible();
    await expect(page.getByText('Contraseña', { exact: true })).toBeVisible();
  });
});

test.describe('Navegación autenticada: launcher, subtrees y SSO', () => {
  test.beforeEach(async ({ page }) => {
    // Sembrar una sesión autenticada ANTES de que ejecuten los scripts de la
    // página: authStore.initialize() marca isAuthenticated=true cuando existen
    // a la vez localStorage.accessToken y localStorage.user.
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

    // Stub del backend: el apiClient tiene un interceptor que, ante cualquier
    // 401 sin refreshToken disponible, ejecuta logout() y redirige a /login
    // (ver shared/api/apiClient.ts). Con un token falso, /profile (llamado por
    // authStore.initialize) devolvería 401 y revocaría la sesión sembrada,
    // haciendo imposible probar la navegación autenticada.
    //
    // Fulfill 200 para el origen del backend evita el 401 y preserva la sesión.
    // IMPORTANTE: el patrón debe anclar al host del backend (http://localhost:5174/api/**)
    // y NO usar '**/api/**', porque ese glob también matchea módulos de código fuente
    // como /src/shared/api/apiClient.ts y rompería la carga de módulos de Vite
    // (MIME type mismatch => la app no monta). Esto NO debilita las aserciones
    // (rutas, launcher, marcadores estáticos): solo estabiliza la precondición de
    // sesión autenticada que el test requiere.
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

    // Cada tile del launcher es un <Link aria-label={app.label}>: el nombre
    // accesible coincide exacto con la etiqueta del registro de apps.
    await expect(page.getByRole('link', { name: 'CxP', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Recursos Humanos', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Educación Médica', exact: true })).toBeVisible();
  });

  test('tile de Educación Médica navega a su dashboard', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'networkidle' });

    await page.getByRole('link', { name: 'Educación Médica', exact: true }).click();

    // El tile apunta al índice del subárbol; estando autenticado, AppSubtreeIndex
    // redirige al dashboard del subárbol.
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

    // El dashboard de CxP hace llamadas al API (pueden fallar con el token falso);
    // aquí solo se afirma la resolución de ruta, no el contenido del dashboard.
    await expect(page).toHaveURL(/\/cxp\/dashboard/);
    // Confirmación negativa: no debe rebotar al login por-app.
    await expect(page).not.toHaveURL(/\/cxp\/login/);
  });
});
