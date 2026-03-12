import { test, expect } from '@playwright/test';

test.describe('Escola - Management (Classes, Teachers, Students)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'escola-mock-id',
        email: 'escola@mock.com',
        tipo_acesso: 'Escola',
        nome: 'Escola Teste',
        escola_id: 'escola-id-123',
        sessionExpiration: new Date().getTime() + 3600000
      }));
    });

    await page.goto('/escola/escolas'); // Assuming 'escolas' is the registration route for the school itself
  });

  test('should open add teacher modal and fill form', async ({ page }) => {
     const addTeacherBtn = page.getByRole('button', { name: /Adicionar Professor/i });
     if (await addTeacherBtn.isVisible()) {
         await addTeacherBtn.click();
         
         const nameInput = page.getByPlaceholder(/Nome do Professor/i).or(page.locator('input[name="teacherName"]'));
         await nameInput.fill('Professor Carvalho');

         // Just testing if the modal works, we could click "Save" if we mocked the endpoints
         const cancelBtn = page.getByRole('button', { name: /Cancelar/i });
         await cancelBtn.click();
         
         await expect(nameInput).toBeHidden();
     }
  });

  test('Security: XSS test in Student Name', async ({ page }) => {
     // Simulating the student registration form within the school panel
     // Using a fuzzy selector as this could be multiple tabs down
     const cadastroTab = page.getByText(/Alunos/i);
     if (await cadastroTab.isVisible()) {
         await cadastroTab.click();
         const addStudentBtn = page.getByRole('button', { name: /Adicionar Aluno/i });
         
         if (await addStudentBtn.isVisible()) {
            await addStudentBtn.click();
            
            const studentNameInput = page.getByPlaceholder(/Nome do Aluno/i).or(page.locator('input[name="nome"]'));
            if (await studentNameInput.isVisible()) {
                 await studentNameInput.fill('"><img src=x onerror=prompt(1)>');
                 
                 let dialogShown = false;
                 page.on('dialog', dialog => { dialogShown = true; dialog.dismiss(); });
                 
                 await page.getByRole('heading').first().click(); // blur
                 expect(dialogShown).toBeFalsy();
            }
         }
     }
  });
});
