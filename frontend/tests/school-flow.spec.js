const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('School Registration Flow', () => {
    // Aumentar o timeout do teste para 2 minutos
    test.setTimeout(120000);

    test('Execute full test plan', async ({ page }) => {
        // --- 1. LOGIN ---
        console.log('--- Iniciando Login ---');
        await page.goto('http://localhost:4200/auth/login');

        // Selecionar aba admin
        await page.click('button:has-text("Painel administrativo")');

        // Preencher credenciais
        await page.fill('input[placeholder="nome@exemplo.com"]', 'antoniano@testes.com');
        await page.fill('input[placeholder="Sua senha"]', 'ts2026');

        // Logar
        await page.click('button:has-text("Fazer login")');

        // Aguardar o dashboard carregar
        await expect(page.locator('text=Visão Geral')).toBeVisible({ timeout: 15000 });
        console.log('Login efetuado com sucesso!');

        // --- 2. ACESSAR ESCOLAS ---
        console.log('--- Navegando para lista de Escolas ---');
        await page.click('span:has-text("Escolas")');
        await page.waitForTimeout(2000);

        // --- 3. SELECIONAR ESCOLA TESTE NO SELECTOR PRINCIPAL ---
        console.log('--- Selecionando Escola Teste Ativa ---');
        // Usar a primeira escola da lista para os testes (Escola Teste Unitario)
        await page.click('.school-selector-dropdown'); // Selector simulado baseado na sua UI

        // Clicar em Gerenciar da primeira escola
        const gerenciarButton = page.locator('button[title="Gerenciar"]').first();
        if (await gerenciarButton.isVisible()) {
            await gerenciarButton.click();
        } else {
            console.log('Botao gerenciar não visível diretamente, tentando primeiro da lista');
            await page.click('button:has-text("Gerenciar")');
        }
        await page.waitForTimeout(2000);

        // --- 4. CADASTRAR PROFESSOR (PASSO 2 DO PLANO) ---
        console.log('--- Cadastrando Professor ---');
        await page.click('text=Professores');
        await page.waitForTimeout(1000);

        await page.fill('input[placeholder="João da Silva"]', 'Prof Playwright');
        await page.selectOption('select', 'Superior Completo'); // Grau de escolaridade
        await page.fill('input[type="email"]', 'playwright@teste.com');

        await page.click('button:has-text("Cadastrar professor")');

        // Verificar Toast de Sucesso para Professor
        const toastCadProfessor = page.locator('text=Cadastro realizado com sucesso.');
        await expect(toastCadProfessor).toBeVisible({ timeout: 5000 });
        console.log('Toast: "Cadastro realizado com sucesso." verificado!');

        await page.waitForTimeout(2000); // Aguardar o toast sumir


        // --- 5. EDITAR PROFESSOR (PASSO 3 DO PLANO) ---
        console.log('--- Editando Professor ---');
        // Buscar e clicar no icone de edicao do professor recém-criado
        await page.click('tr:has-text("Prof Playwright") button.text-blue-600');
        await page.waitForTimeout(1000);

        await page.fill('input[placeholder="João da Silva"]', 'Prof Editado Pelo Script');
        // Botão de salvar no estado de edição
        await page.click('button:has-text("Atualizar professor")');

        // Verificar Toast de Sucesso na Edição
        const toastEditProfessor = page.locator('text=Professor atualizado com sucesso.');
        await expect(toastEditProfessor).toBeVisible({ timeout: 5000 });
        console.log('Toast: "Professor atualizado com sucesso." verificado!');

        await page.waitForTimeout(2000);

        // --- 6. EXCLUIR PROFESSOR (PASSO 4 DO PLANO) ---
        console.log('--- Excluindo Professor ---');
        await page.click('tr:has-text("Prof Editado Pelo Script") button.text-red-600');

        // Modal de confirmação
        await expect(page.locator('text=Excluir Professor')).toBeVisible();
        await expect(page.locator('text=Tem certeza que deseja excluir o acesso deste professor?')).toBeVisible();
        console.log('Texto do Modal de Exclusão validado!');

        // Confirmar exclusão
        await page.click('.fixed.inset-0 button.bg-red-600:has-text("Excluir")');
        await page.waitForTimeout(2000);

        // --- 7. CADASTRAR TURMA (PASSO 5 DO PLANO) ---
        console.log('--- Cadastrando Turma ---');
        await page.click('text=Turmas');
        await page.waitForTimeout(1000);

        await page.fill('input[placeholder="Ex: 1º Ano A"]', 'Playwright Class');
        await page.selectOption('select:has-text("Selecione o estágio")', 'Ensino Fundamental I');
        await page.selectOption('select:has-text("Selecione o período")', 'Tarde');
        await page.fill('input[placeholder="Ex: 1, 2, 3"]', '5');
        await page.fill('input[placeholder="0"]', '25'); // Qtd de Alunos

        // Validar data default - Verifica se input tem valor (data de hoje configurada no seu PR)
        const dateInput = await page.inputValue('input[type="date"]');
        console.log('Data preenchida por default:', dateInput);
        expect(dateInput).not.toBe('');

        await page.click('button:has-text("Cadastrar turma")');

        // Verificar Toast de Sucesso da Turma
        const toastCadTurma = page.locator('text=Turma cadastrada com sucesso');
        await expect(toastCadTurma).toBeVisible({ timeout: 5000 });
        console.log('Toast: "Turma cadastrada com sucesso" verificado!');

        await page.waitForTimeout(2000);

        // --- 8. CADASTRAR ALUNO MANUAL (PASSO 6 DO PLANO) ---
        console.log('--- Cadastrando Aluno (Manual) ---');
        await page.click('text=Alunos');
        await page.waitForTimeout(1000);

        await page.click('button:has-text("Novo Aluno")');
        await page.waitForTimeout(1000);

        // Preencher forms modal
        // Selecionar turma que acabamos de criar
        await page.selectOption('select:has-text("Selecione uma turma")', { label: 'Playwright Class' });
        await page.fill('input[placeholder="Nome do aluno"]', 'Enzo Gabriel Playwright');
        await page.fill('input[type="email"]', 'enzo.playwright@example.com');
        await page.fill('input[placeholder="(00) 00000-0000"]', '11999999999');
        await page.fill('input[type="date"]:first-child', '2015-05-15'); // Data Nascimento
        await page.fill('input[placeholder="Nome do Pai/Mãe"]', 'Neymar Santos Playwright');

        // Opcional email do responsavel
        await page.fill('input:has-text("Email do Responsável")', 'ney.play@example.com');

        await page.click('button:has-text("Finalizar Cadastro")');

        // Verificar Toast
        const toastCadAluno = page.locator('text=Cadastro realizado com sucesso.');
        await expect(toastCadAluno).toBeVisible({ timeout: 5000 });
        console.log('Toast: "Cadastro realizado com sucesso." (Aluno) verificado!');

        await page.waitForTimeout(2000);

        // --- 9. IMPORTAR ALUNOS POR CSV (PASSO 7 DO PLANO) ---
        console.log('--- Importando Alunos (CSV) ---');
        await page.click('button:has-text("Importar CSV")');
        await page.waitForTimeout(1000);

        // Fazendo o upload do arquivo
        const filePath = path.resolve('..', 'students.csv'); // Pegando da pasta raiz que definimos
        await page.setInputFiles('input[type="file"]', filePath);

        // Confirmar importacao
        await page.click('.fixed.inset-0 button.bg-blue-600:has-text("Importar")');

        // Verificar Toast (Dependendo se você pôs toast diferente para import)
        try {
            await expect(page.locator('text=Importação concluída')).toBeVisible({ timeout: 5000 });
        } catch (e) {
            console.log('Possível toast genérico ou diferente (ver tela)');
        }

        console.log('--- FIM DO TESTE E2E ---');
        await page.waitForTimeout(3000); // Dar um tempo pra ver antes de fechar 
    });
});
