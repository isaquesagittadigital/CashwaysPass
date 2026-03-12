import { test, expect } from '@playwright/test';

test.describe('Admin - School Registration & Masks', () => {
  // Since we don't have static credentials to login properly without affecting prod DB,
  // we can mock the localStorage or intercept the API to simulate a logged-in state.
  
  test.beforeEach(async ({ page }) => {
    // 1. Visit root to establish context
    await page.goto('/');
    
    // 2. Inject mock auth token into localStorage to bypass login screen
    await page.evaluate(() => {
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'admin-mock-id',
        email: 'admin@mock.com',
        tipo_acesso: 'Admin',
        nome: 'Admin Teste',
        sessionExpiration: new Date().getTime() + 3600000
      }));
    });

    // 3. Navigate to schools route
    await page.goto('/admin/escolas');
  });

  test('should load school list and navigation', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Escolas' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nova Escola/i }).or(page.getByText('Nova Escola'))).toBeVisible();
  });

  test('should open new school form and validate mask inputs', async ({ page }) => {
    // Clica em "Nova Escola" ou equivalente (pode ser o label da tab se for tabbed interface)
    // Precisaria ajustar os seletores exatos conforme a aba de cadastro
    const newSchoolBtn = page.getByRole('button', { name: /Nova Escola/i }).or(page.getByText('Nova Escola'));
    
    // Tratar se for abas ao invés de botão
    if (await newSchoolBtn.isVisible()) {
        await newSchoolBtn.click();
    } else {
        // Assume tabs: "Lista de Escolas" | "Cadastro"
        await page.getByText('Cadastro', { exact: true }).click();
    }

    // Identificar os campos mascarados
    // Exemplo: CNPJ, CEP, Telefone
    
    // 1. Test CNPJ Mask
    const cnpjInput = page.getByPlaceholder(/CNPJ/i).or(page.locator('input[name="cnpj"]'));
    if (await cnpjInput.isVisible()) {
        await cnpjInput.fill('123abc456def789012'); // mix of letters and numbers
        // After ngx-mask applies, it should only keep numbers and format correctly
        // 12.345.678/9012-.. (max 14 digits)
        const cnpjValue = await cnpjInput.inputValue();
        expect(cnpjValue).toMatch(/^[\d\.\-\/]+$/); // Should not have letters "abc"
    }

    // 2. Test CEP Mask
    const cepInput = page.getByPlaceholder(/CEP/i).or(page.locator('input[name="cep"]'));
    if (await cepInput.isVisible()) {
        await cepInput.fill('01001-000');
        await cepInput.press('Backspace'); // remove last 0 to test raw formatting typing
        await cepInput.fill('01001000asdf');
        const cepValue = await cepInput.inputValue();
        expect(cepValue).toBe('01001-000'); // the 'asdf' shouldn't register, formatting applies correctly
    }

    // 3. Test Monetary Input (Valor Equipamento)
    const valorInput = page.getByPlaceholder(/Valor Unit.rio/i).or(page.locator('input[name="valorUnitarioEquipamento"]'));
    if (await valorInput.isVisible()) {
        await valorInput.fill('1250'); 
        // Depending on mask config (suffix/prefix R$), it might format as 12,50 or 1.250,00
        const val = await valorInput.inputValue();
        expect(val).toContain(','); // should have decimal separator
    }
  });

  test('Security: XSS test in School Name', async ({ page }) => {
    const cadastroTab = page.getByText('Cadastro', { exact: true });
    if (await cadastroTab.isVisible()) {
       await cadastroTab.click();
    }
    
    const nomeInput = page.getByPlaceholder(/Nome Fantasia/i).or(page.locator('input[name="nome"]'));
    if (await nomeInput.isVisible()) {
       await nomeInput.fill('<script>alert("XSS")</script>');
       // Tenta avanzar ou preencher resto
       // Angular sanitiza automaticamente templates 
       // Se houvesse vulnerabilidade, veríamos um dialog 
       
       let dialogShown = false;
       page.on('dialog', dialog => { dialogShown = true; dialog.dismiss(); });
       
       // Click somewhere else to trigger blur
       await page.getByRole('heading').first().click();
       
       expect(dialogShown).toBeFalsy();
    }
  });
});
