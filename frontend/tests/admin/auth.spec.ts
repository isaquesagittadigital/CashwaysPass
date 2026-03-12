import { test, expect } from '@playwright/test';

test.describe('Admin Authentication & Security', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the login page (assumed to be root)
    await page.goto('/');
  });

  test('should display login form elements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();
    
    // Check if the browser or custom validation prevents submission
    // We expect an error message or the input to require focus
    // Adjust based on exact UI implementation. Assuming some toast or visual cue.
    // If it relies on native HTML5 validity:
    const emailInput = page.locator('input[type="email"]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test('should fail with invalid credentials', async ({ page }) => {
    await page.locator('input[type="email"]').fill('admin_fake_test@naoexiste.com');
    await page.locator('input[type="password"]').fill('senha_errada');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Check for error toast or message
    await expect(page.locator('text=Erro').or(page.locator('text=Inválido')).or(page.locator('text=Credenciais'))).toBeVisible({ timeout: 5000 });
  });

  test('Security: should prevent access to protected admin routes without login', async ({ page }) => {
    // Attempt to bypass login and go straight to admin dashboard
    await page.goto('/admin/dashboard');

    // It should redirect back to login or show unauthorized
    // Assuming root '/' is login
    await expect(page).toHaveURL(/\/$/);
  });
});
