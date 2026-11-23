import { test, expect } from '@playwright/test';

const USUARIO = '54';
const PASSWORD = 'tt01tt';

test.describe('Login Flow', () => {
  test('login con credenciales válidas redirige al dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const inputUsuario = page.locator('input[type="text"]');
    await expect(inputUsuario).toBeVisible();
    await inputUsuario.fill(USUARIO);
    await page.locator('button[type="submit"]').click();

    const inputPassword = page.locator('input[type="password"]');
    await expect(inputPassword).toBeVisible({ timeout: 10_000 });
    await inputPassword.fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

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

    await page.waitForTimeout(3_000);
    expect(page.url()).not.toContain('/dashboard');
  });
});
