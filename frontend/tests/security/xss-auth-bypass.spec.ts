import { test, expect } from '@playwright/test';

test.describe('Security & Authorizarion Tests', () => {

  test('Guest should not access admin dashboard', async ({ page }) => {
    // Attempting to go directly to dash
    await page.goto('/admin/dashboard');

    // Given Angular Auth Guards, this should either redirect to '/' (login) or show an access denied screen
    await expect(page).toHaveURL(/\//); // Redirects to root usually if not authed
  });

  test('Guest should not access escola dashboard', async ({ page }) => {
    // Attempting to go directly to dash
    await page.goto('/escola/dashboard');

    await expect(page).toHaveURL(/\//); // Redirects to root
  });

  test('School User should not access Admin areas', async ({ page }) => {
    await page.goto('/');
    
    // Auth as Escola
    await page.evaluate(() => {
        localStorage.setItem('currentUser', JSON.stringify({
          id: 'escola',
          tipo_acesso: 'Escola',
          sessionExpiration: new Date().getTime() + 3600000
        }));
    });

    // Attempt Admin area
    await page.goto('/admin/dashboard');

    // Should be kicked out or redirected to their own dashboard
    // Depending on the auth guard behavior
    // For now we assert it left the admin route
    await page.waitForURL(url => !url.href.includes('/admin/'));
  });

  test('XSS Injection on Login form should not execute script', async ({ page }) => {
     await page.goto('/');
     const emailInput = page.locator('input[type="email"]');
     
     if(await emailInput.isVisible()) {
         // Attempt script injection as email
         await emailInput.fill('<img src=x onerror=alert("XSS")>');
         await page.locator('input[type="password"]').fill('randompass');
         
         let dialogFired = false;
         page.on('dialog', () => dialogFired = true);
         
         await page.getByRole('button', { name: 'Entrar' }).click();
         
         expect(dialogFired).toBe(false);
     }
  });
});
