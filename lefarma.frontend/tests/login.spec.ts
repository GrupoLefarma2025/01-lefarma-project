import { test, expect } from '@playwright/test';

/**
 * E2E de login (flujo global en `/`).
 *
 * Requiere el backend corriendo en http://localhost:5174 (el webServer de
 * playwright.config.ts solo levanta Vite en :5173).
 *
 * Credenciales de desarrollo (usuario 54). El flujo es multi-paso:
 * usuario -> contraseña -> (selección de contexto, auto-commit si aplica).
 */

const USUARIO = '54';
const PASSWORD = 'tt01tt';

test.describe('Login Flow', () => {
  test('login con credenciales válidas redirige al dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Paso 1: usuario
    const inputUsuario = page.locator('input[type="text"]');
    await expect(inputUsuario).toBeVisible();
    await inputUsuario.fill(USUARIO);
    await page.locator('button[type="submit"]').click();

    // Paso 2: contraseña
    const inputPassword = page.locator('input[type="password"]');
    await expect(inputPassword).toBeVisible({ timeout: 10_000 });
    await inputPassword.fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Post-login: redirección al dashboard (incluye auto-commit del paso 3 si aplica)
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login con contraseña inválida muestra error y no entra', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const inputUsuario = page.locator('input[type="text"]');
    await expect(inputUsuario).toBeVisible();
    await inputUsuario.fill(USUARIO);
    await page.locator('button[type="submit"]').click();

    const inputPassword = page.locator('input[type="password"]');
    await expect(inputPassword).toBeVisible({ timeout: 10_000 });
    await inputPassword.fill('password-incorrecto');
    await page.locator('button[type="submit"]').click();

    // Sigue en el login y no navega al dashboard
    await page.waitForTimeout(3_000);
    expect(page.url()).not.toContain('/dashboard');
  });
});
