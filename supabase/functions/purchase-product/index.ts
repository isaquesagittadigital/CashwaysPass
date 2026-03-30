import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeString(str: string) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isUUID(str: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const rawBody = await req.text();
        let body;
        try {
            body = JSON.parse(rawBody);
        } catch (e: any) {
            throw new Error(`JSON invalido. Erro: ${e.message}`);
        }

        const { aluno_id, lojista_id, produto_id, quantidade } = body;

        if (!aluno_id || !produto_id) {
            throw new Error("Parametros invalidos. Necessario: aluno_id e produto_id.")
        }

        const qtd = Number(quantidade || 1);
        if (qtd <= 0) {
            throw new Error("A quantidade de produtos deve ser maior que zero.");
        }

        console.log(`[DEBUG] Compra Individual. Aluno: ${aluno_id}, Lojista: ${lojista_id || 'N/A'}, Produto: ${produto_id}, Qtd: ${qtd}`);

        // --- PASSO 1: Obter Dados do Lojista (se fornecido) ---
        let lojistaNome = "Sistema";
        let totalVendasAtual = 0;

        if (lojista_id) {
            const { data: lojista } = await supabaseClient
                .from('usuarios')
                .select('nome, total_vendas')
                .eq('UserID', lojista_id)
                .single()
            if (lojista) {
                lojistaNome = lojista.nome || "Lojista Desconhecido";
                totalVendasAtual = Number(lojista.total_vendas || 0);
            }
        }

        // --- PASSO 2: Validar Produto e buscar seu PROPOSITO ---
        const { data: dbProd, error: prodError } = await supabaseClient
            .from('produto')
            .select('id, nome, preco, url_imagem, descricao, limete_por_aluno, quantidade, proposito')
            .eq('id', produto_id)
            .single();

        if (prodError || !dbProd) {
            throw new Error(`Produto nao encontrado (ID: ${produto_id}).`);
        }

        // Proposito do produto — define qual saldo sera debitado
        const propositoProduto = (dbProd.proposito || 'Mercado').trim();
        console.log(`[DEBUG] Proposito do produto: "${propositoProduto}"`);

        // --- PASSO 2.1: Validar Estoque ---
        const estoqueAtual = dbProd.quantidade;
        if (estoqueAtual !== null && estoqueAtual !== undefined) {
            if (qtd > estoqueAtual) {
                throw new Error(`Estoque insuficiente. Este produto possui apenas ${estoqueAtual} unidades disponiveis.`);
            }
        }

        const precoUnitario = Number(dbProd.preco || 0);
        const valorTotalNum = precoUnitario * qtd;

        console.log(`[DEBUG] Valor total: ${valorTotalNum} (${qtd}x R$${precoUnitario})`);

        if (valorTotalNum <= 0) {
            throw new Error("O valor da compra deve ser maior que zero.");
        }

        // --- PASSO 2.5: Identificar Aluno ---
        // Busca por: id direto, user_id (auth UUID na tabela aluno), ou usuario_id (numérico)
        // Também tenta pelo UserID da tabela usuarios (que o Bubble pode enviar)
        let alunoData: any = null;

        if (isUUID(String(aluno_id))) {
            // Tenta id ou user_id na tabela aluno
            const { data: alunoByUUID } = await supabaseClient
                .from('aluno')
                .select('id, nome, turma_id, user_id, usuario_id')
                .or(`id.eq.${aluno_id},user_id.eq.${aluno_id}`)
                .maybeSingle();

            if (alunoByUUID) {
                alunoData = alunoByUUID;
            } else {
                // Fallback: busca na tabela usuarios pelo UserID e então acha o aluno pelo email/usuario_id
                const { data: usuarioRef } = await supabaseClient
                    .from('usuarios')
                    .select('id, email, UserID')
                    .eq('UserID', aluno_id)
                    .maybeSingle();

                if (usuarioRef) {
                    // Tenta achar o aluno por usuario_id usando o id da tabela usuarios
                    const { data: alunoByUsuario } = await supabaseClient
                        .from('aluno')
                        .select('id, nome, turma_id, user_id, usuario_id')
                        .or(`user_id.eq.${aluno_id},usuario_id.eq.${usuarioRef.id}`)
                        .maybeSingle();
                    if (alunoByUsuario) alunoData = alunoByUsuario;
                }
            }
        } else {
            // ID numérico: busca por usuario_id
            const { data: alunoByNumId } = await supabaseClient
                .from('aluno')
                .select('id, nome, turma_id, user_id, usuario_id')
                .eq('usuario_id', aluno_id)
                .maybeSingle();
            if (alunoByNumId) alunoData = alunoByNumId;
        }

        if (!alunoData) {
            throw new Error(`Aluno nao encontrado no sistema (buscado por ID: ${aluno_id}).`);
        }

        const realAlunoId = alunoData.id;
        const authUserId = alunoData.user_id;

        console.log(`[DEBUG] Aluno encontrado: ${alunoData.nome} (id: ${realAlunoId}, user_id: ${authUserId})`);

        // --- Validar Limite de Compras ---
        const { data: pastPurchases } = await supabaseClient
            .from('produtos_aluno')
            .select('id, quantidade')
            .eq('aluno_id', realAlunoId)
            .eq('produto_id', produto_id);

        let qtdJaComprada = 0;
        if (pastPurchases && pastPurchases.length > 0) {
            qtdJaComprada = pastPurchases.reduce((acc, curr) => acc + (curr.quantidade || 1), 0);
        }

        const maxLimit = dbProd.limete_por_aluno;
        if (maxLimit !== null && maxLimit !== undefined && typeof maxLimit === 'number') {
            if ((qtdJaComprada + qtd) > maxLimit) {
                throw new Error(`Limite de compra excedido. O limite e de ${maxLimit} itens. Voce ja comprou ${qtdJaComprada}.`);
            }
        }

        // --- PASSO 3: Validar Saldo do PROPOSITO do produto ---
        const { data: todosPropositos, error: propError } = await supabaseClient
            .from('propositos')
            .select('id, saldo, nome')
            .eq('usuario_id', authUserId)

        if (propError || !todosPropositos || todosPropositos.length === 0) {
            throw new Error(`Nenhum proposito encontrado para este aluno. (User: ${authUserId})`);
        }

        const targetNameNormalized = normalizeString(propositoProduto);
        const propositoAluno = todosPropositos?.find(p => {
            const dbNameNormalized = normalizeString(p.nome || '');
            return dbNameNormalized === targetNameNormalized;
        });

        if (!propositoAluno) {
            throw new Error(`Voce nao possui o proposito '${propositoProduto}' ou ele nao foi encontrado na sua conta.`);
        }

        const saldoRaw = String(propositoAluno.saldo || '0').trim();
        const saldoAtual = parseFloat(saldoRaw.replace(',', '.'));

        console.log(`[DEBUG] Saldo do proposito "${propositoProduto}": R$ ${saldoAtual}`);

        if (saldoAtual < valorTotalNum) {
            throw new Error(`Saldo insuficiente em ${propositoProduto}. Voce tem R$ ${saldoAtual.toFixed(2)} e tentou gastar R$ ${valorTotalNum.toFixed(2)}.`);
        }

        // --- PASSO 4: Registrar compra em produtos_aluno ---
        const { error: insertError } = await supabaseClient
            .from('produtos_aluno')
            .insert({
                aluno_id: realAlunoId,
                produto_id: dbProd.id,
                nome_item: dbProd.nome,
                descricao: dbProd.descricao,
                imagem_url: dbProd.url_imagem,
                valor_compra: precoUnitario,
                quantidade: qtd,
                lojista_id: lojista_id || null,
                status_item: 'Comprado',
                data_acao: new Date().toISOString(),
                data_compra: new Date().toISOString()
            });

        if (insertError) {
            console.error("Erro ao salvar em produtos_aluno:", insertError);
            throw new Error(`Falha ao registrar o produto no historico do aluno.`);
        }

        // --- PASSO 4.1: Atualizar Estoque ---
        if (dbProd.quantidade !== null && dbProd.quantidade !== undefined) {
            await supabaseClient
                .from('produto')
                .update({ quantidade: dbProd.quantidade - qtd })
                .eq('id', produto_id);
        }

        // --- PASSO 5: Debitar Saldo do Proposito correto ---
        const novoSaldoAluno = saldoAtual - valorTotalNum;

        const { error: updateAlunoError } = await supabaseClient
            .from('propositos')
            .update({ saldo: novoSaldoAluno.toString() })
            .eq('id', propositoAluno.id)

        if (updateAlunoError) {
            throw new Error("Erro ao atualizar saldo de " + propositoProduto + ": " + updateAlunoError.message);
        }

        // --- PASSO 6: Atualizar Lojista ---
        let novoTotalVendas = totalVendasAtual;
        if (lojista_id) {
            novoTotalVendas = totalVendasAtual + valorTotalNum;
            await supabaseClient
                .from('usuarios')
                .update({ total_vendas: novoTotalVendas })
                .eq('UserID', lojista_id)
        }

        // --- PASSO 7: Logs ---
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const currentMonth = monthNames[new Date().getMonth()];

        const { error: logError } = await supabaseClient.from('movimentacao_financeira').insert({
            aluno_id: realAlunoId,
            tipo_operacao: `COMPRA_PRODUTO_${normalizeString(propositoProduto).toUpperCase()}`,
            categoria: propositoProduto,
            nome_operacao: `Compra ${propositoProduto}: ${dbProd.nome}`,
            valor: valorTotalNum.toString(),
            mes_operacao: currentMonth,
            status: 'CONCLUIDO',
            request_payload: { aluno_id, lojista_id, produto_id, quantidade: qtd, valor: valorTotalNum, proposito: propositoProduto },
            response_payload: {
                mensagem: `Compra ${propositoProduto}: ${dbProd.nome} em ${lojistaNome}`,
                novo_saldo_aluno: novoSaldoAluno,
                novo_total_vendas_lojista: novoTotalVendas
            },
            http_status: 200
        });

        if (logError) {
            console.error("Erro ao salvar log em movimentacao_financeira:", logError);
            // Poderíamos ignorar ou lançar erro. Dado o fluxo financeiro, é melhor lançar para manter integridade.
            throw new Error(`Falha ao registrar log financeiro: ${logError.message}`);
        }

        await supabaseClient.from('investimento_aluno').insert({
            aluno_id: realAlunoId,
            titulo: 'COMPRA_PRODUTO',
            descricao: `Compra de produto: ${dbProd.nome}`,
            valor: valorTotalNum,
            status_investimento: 'PAGO',
            url_imagem: dbProd.url_imagem,
            created_date: new Date().toISOString(),
            data_inicio: new Date().toISOString().split('T')[0]
        });

        if (lojista_id) {
            try {
                let nomeTurma = "Sem Turma";
                if (alunoData?.turma_id) {
                    const { data: turmaInfo } = await supabaseClient
                        .from('turma')
                        .select('nome')
                        .eq('id', alunoData.turma_id)
                        .single();
                    if (turmaInfo?.nome) nomeTurma = turmaInfo.nome;
                }

                const nomeAluno = alunoData?.nome || "Aluno Desconhecido";
                await supabaseClient.from('lojista_historico').insert({
                    lojista_id: lojista_id,
                    aluno_id: realAlunoId,
                    aluno_nome: nomeAluno,
                    aluno_turma: nomeTurma,
                    valor: valorTotalNum,
                    tipo_operacao: 'VENDA',
                    saldo_vendas_pos: novoTotalVendas,
                    descricao: `Venda: ${qtd}x ${dbProd.nome} - Aluno: ${nomeAluno} - ${nomeTurma}`
                });
            } catch (e) {
                console.error("Erro nao-bloqueante ao gerar historico lojista:", e);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Compra adquirida com sucesso!",
            data: {
                proposito_nome: propositoProduto,
                lojista_nome: lojistaNome,
                valor_total: valorTotalNum,
                novo_saldo_aluno: novoSaldoAluno,
                produto: dbProd.nome,
                quantidade: qtd,
                valor_unitario_momento: precoUnitario,
                limite_por_aluno: dbProd.limete_por_aluno
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Purchase Product:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
