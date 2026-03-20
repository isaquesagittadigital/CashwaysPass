import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper funcs
function normalizeString(str: string) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isUUID(str: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

Deno.serve(async (req) => {
    // 1. CORS Preflight
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
            throw new Error(`O JSON enviado estÃ¡ invÃ¡lido. Erro: ${e.message}`);
        }
        
        // lojista_id agora Ã© opcional
        const { aluno_id, lojista_id, produto_id, quantidade } = body;

        // ValidaÃ§Ãµes bÃ¡sicas
        if (!aluno_id || !produto_id) {
            throw new Error("ParÃ¢metros invÃ¡lidos. NecessÃ¡rio: aluno_id e produto_id.")
        }

        const qtd = Number(quantidade || 1);
        if (qtd <= 0) {
            throw new Error("A quantidade de produtos deve ser maior que zero.");
        }

        console.log(`[DEBUG] Iniciando Compra Individual. Aluno: ${aluno_id}, Lojista: ${lojista_id || 'N/A'}, Produto: ${produto_id}, Qtd: ${qtd}`);

        // --- PASSO 1: Obter Dados do Lojista (se fornecido) ---
        let lojistaNome = "Sistema";
        let totalVendasAtual = 0;
        
        if (lojista_id) {
            const { data: lojista, error: lojistaError } = await supabaseClient
                .from('usuarios')
                .select('nome, total_vendas')
                .eq('UserID', lojista_id)
                .single()

            if (!lojistaError && lojista) {
                lojistaNome = lojista.nome || "Lojista Desconhecido";
                totalVendasAtual = Number(lojista.total_vendas || 0);
            }
        }

        // --- PASSO 2: Validar Produto e Calcular Valor Total ---
        const { data: dbProd, error: prodError } = await supabaseClient
            .from('produto')
            .select('id, nome, preco, url_imagem, descricao, limete_por_aluno')
            .eq('id', produto_id)
            .single();

        if (prodError || !dbProd) {
            throw new Error(`Produto nÃ£o encontrado (ID: ${produto_id}).`);
        }

        const precoUnitario = Number(dbProd.preco || 0);
        const valorTotalNum = precoUnitario * qtd;

        console.log(`[DEBUG] Valor total calculado: ${valorTotalNum} (${qtd}x ${precoUnitario})`);

        if (valorTotalNum <= 0) {
             throw new Error("O valor da compra deve ser maior que zero.");
        }

        // --- PASSO 2.5: Identificar Aluno e Validar Limite de Compras ---
        let queryAluno = supabaseClient.from('aluno').select('id, nome, turma_id');
        if (isUUID(aluno_id)) {
            queryAluno = queryAluno.or(`id.eq.${aluno_id},user_id.eq.${aluno_id}`);
        } else {
            queryAluno = queryAluno.eq('usuario_id', aluno_id);
        }

        const { data: alunoData, error: alunoError } = await queryAluno.maybeSingle();

        if (alunoError || !alunoData) {
            throw new Error(`Aluno nÃ£o encontrado no sistema (buscado por ID ou User_ID).`);
        }

        const realAlunoId = alunoData.id;

        // Sempre busca a quantidade que o aluno jÃ¡ comprou deste produto
        const { data: pastPurchases, error: pastError } = await supabaseClient
            .from('produtos_aluno')
            .select('id, quantidade')
            .eq('aluno_id', realAlunoId)
            .eq('produto_id', produto_id);

        let qtdJaComprada = 0;
        let existingRecordId = null;

        if (!pastError && pastPurchases && pastPurchases.length > 0) {
            qtdJaComprada = pastPurchases.reduce((acc, curr) => acc + (curr.quantidade || 1), 0);
            existingRecordId = pastPurchases[0].id;
        }

        const maxLimit = dbProd.limete_por_aluno;
        if (maxLimit !== null && maxLimit !== undefined && typeof maxLimit === 'number') {
            if ((qtdJaComprada + qtd) > maxLimit) {
                throw new Error(`Limite de compra excedido. O limite para este produto Ã© de ${maxLimit} itens. VocÃª jÃ¡ garantiu ${qtdJaComprada} e tentou comprar mais ${qtd}.`);
            }
        }

        // --- PASSO 3: Validar Saldo "Mercado" ---
        const { data: todosPropositos, error: propError } = await supabaseClient
            .from('propositos')
            .select('id, saldo, nome')
            .eq('usuario_id', aluno_id)

        if (propError) {
             throw new Error("Erro de banco ao buscar saldos do aluno.");
        }

        const targetNameNormalized = normalizeString('Mercado');
        const propositoAluno = todosPropositos?.find(p => {
            const dbNameNormalized = normalizeString(p.nome || '');
            return dbNameNormalized === targetNameNormalized;
        });

        if (!propositoAluno) {
             throw new Error(`VocÃª nÃ£o possui o propÃ³sito 'Mercado' ou ele nÃ£o foi encontrado na sua conta.`);
        }

        const saldoRaw = String(propositoAluno.saldo || '0').trim(); 
        const saldoNormalizado = saldoRaw.replace(',', '.'); 
        const saldoAtual = parseFloat(saldoNormalizado);

        console.log(`[DEBUG] Saldo do propÃ³sito "Mercado": R$ ${saldoAtual}`);

        if (saldoAtual < valorTotalNum) {
            throw new Error(`Saldo insuficiente no Mercado. VocÃª tem R$ ${saldoAtual.toFixed(2)} e tentou gastar R$ ${valorTotalNum.toFixed(2)}.`);
        }

        // --- PASSO 4: Criar ou Atualizar na tabela "produtos_aluno" ---
        let upsertError = null;

        if (existingRecordId) {
            // Atualiza registro existente somando a quantidade e modificando valor_compra para o atual
            const novaQtd = qtdJaComprada + qtd;
            const { error: updateError } = await supabaseClient
                .from('produtos_aluno')
                .update({
                    quantidade: novaQtd,
                    valor_compra: precoUnitario,
                    data_acao: new Date().toISOString()
                })
                .eq('id', existingRecordId);
            upsertError = updateError;
        } else {
            // Cria novo registro
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
                    lojista_id: lojista_id || null, // Nulo se nÃ£o fornecido
                    status_item: 'Comprado',
                    data_acao: new Date().toISOString()
                });
            upsertError = insertError;
         // --- PASSO 6: Salvar Log em movimentacao_financeira ---
        const { error: logError } = await supabaseClient
            .from('movimentacao_financeira')
            .insert({
                aluno_id: realAlunoId,
                tipo_operacao: 'Compra de Produto',
                status: 'CONCLUIDO',
                request_payload: body,
                response_payload: {
                    mensagem: "Compra aprovada localmente, sem API externa",
                    aluno_nome: alunoData.nome,
                    item: dbProd.nome,
                    valor_unitario: precoUnitario,
                    quantidade: qtd,
                    valor_total: valorTotalNum, // Changed from valorTotal to valorTotalNum
                    saldo_restante_mercado: Number(saldoAtual) - valorTotalNum // Changed from saldoMercado to saldoAtual and valorTotal to valorTotalNum
                }
            });

        if (logError) {
            console.error("Erro salvando log na movimentacao_financeira:", logError);
        }    throw new Error(`Falha ao registrar o produto no histÃ³rico do aluno. A compra nÃ£o pÃ´de ser completada.`);
        }

        if (upsertError) {
            console.error("Erro ao salvar em produtos_aluno:", upsertError);
            throw new Error(`Falha ao registrar o produto no histÃ³rico do aluno. A compra nÃ£o pÃ´de ser completada.`);
        }

        // --- PASSO 5: Executar DeduÃ§Ã£o do Saldo ---
        const novoSaldoAluno = saldoAtual - valorTotalNum;

        const { error: updateAlunoError } = await supabaseClient
            .from('propositos')
            .update({ saldo: novoSaldoAluno.toString() }) 
            .eq('id', propositoAluno.id)

        if (updateAlunoError) {
             throw new Error("Erro ao atualizar saldo do Mercado: " + updateAlunoError.message);
        }

        // --- PASSO 6: Atualizar Lojista (se fornecido) ---
        let novoTotalVendas = totalVendasAtual;
        if (lojista_id) {
            novoTotalVendas = totalVendasAtual + valorTotalNum;
            await supabaseClient
                .from('usuarios')
                .update({ total_vendas: novoTotalVendas })
                .eq('UserID', lojista_id)
        }

        // --- PASSO 7: Historico e Log ---
        await supabaseClient.from('movimentacao_financeira').insert({
            tipo_operacao: 'COMPRA_PRODUTO_INDIVIDUAL',
            status: 'SUCESSO',
            request_payload: { aluno_id, lojista_id, produto_id, quantidade: qtd, valor: valorTotalNum, proposito: 'Mercado' },
            response_payload: { 
                mensagem: `Compra de ${dbProd.nome} realizada em ${lojistaNome} (Mercado)`,
                novo_saldo_aluno: novoSaldoAluno,
                novo_total_vendas_lojista: novoTotalVendas
            },
            http_status: 200
        })

        // HistÃ³rico Lojista (apenas se lojista_id existir)
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
                const descricaoHistorico = `Venda: ${qtd}x ${dbProd.nome} - Aluno: ${nomeAluno} - ${nomeTurma}`;

                await supabaseClient
                    .from('lojista_historico')
                    .insert({
                        lojista_id: lojista_id,
                        aluno_id: realAlunoId,
                        aluno_nome: nomeAluno,
                        aluno_turma: nomeTurma,
                        valor: valorTotalNum,
                        tipo_operacao: 'VENDA',
                        saldo_vendas_pos: novoTotalVendas,
                        descricao: descricaoHistorico
                    });
            } catch(e) {
                console.error("Erro nÃ£o-bloqueante ao gerar histÃ³rico:", e);
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Compra realizada com sucesso!",
            data: {
                proposito_nome: "Mercado",
                lojista_nome: lojistaNome,
                valor_total: valorTotalNum,
                novo_saldo_aluno: novoSaldoAluno,
                produto: dbProd.nome,
                quantidade: qtd,
                valor_unitario_momento: precoUnitario,
                limite_por_aluno: dbProd.limete_por_aluno,
                quantidade_acumulada_aluno: qtdJaComprada + qtd
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

