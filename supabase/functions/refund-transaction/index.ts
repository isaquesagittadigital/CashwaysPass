import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para normalizar strings (remover acentos e lowercase)
function normalizeString(str: string) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

        // --- MAGIC BODY PARSER (Robustez para JSON mal formatado) ---
        const rawBody = await req.text();
        let body;
        
        try {
            body = JSON.parse(rawBody);
        } catch (e: any) {
            // Tentativa 2: Corrigir "Vício Brasileiro" (ex: "valor": 10,50 -> a virgula quebra o JSON)
            const fixedBody = rawBody.replace(/:\s*(\d+),(\d+)/g, ': $1.$2');
            try {
                body = JSON.parse(fixedBody);
                console.warn("[WARN] JSON recuperado via sanitização de vírgulas.");
            } catch (e2: any) {
                console.error("Erro Parse JSON Final:", e2);
                throw new Error(`O JSON enviado está inválido. Se estiver enviando números decimais, use ponto (0.50) ou aspas ("0,50"). Erro: ${e.message}`);
            }
        }
        
        const { aluno_id, lojista_id, valor_devolucao } = body;

        // Validações Básicas
        if (!aluno_id || !lojista_id || valor_devolucao === undefined || valor_devolucao <= 0) {
            throw new Error("Parâmetros inválidos. Necessário: aluno_id, lojista_id, valor_devolucao (>0).")
        }
        
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str));
        const valorDevolucaoNum = parseFloat(String(valor_devolucao).replace(',', '.')); // Aceita 2,50 ou 2.50

        console.log(`[DEBUG] Iniciando Devolução. Aluno: ${aluno_id}, Lojista: ${lojista_id}, Valor: ${valorDevolucaoNum}`);

        // --- PASSO 1: Obter Dados do Lojista (Propósito e Total Vendas) ---
        let queryLojista = supabaseClient.from('usuarios').select('Proposito_Lojista, nome, total_vendas, total_devolucao, UserID');
        if (isUUID(lojista_id)) {
            queryLojista = queryLojista.eq('UserID', lojista_id);
        } else {
            queryLojista = queryLojista.eq('id', lojista_id);
        }

        const { data: lojista, error: lojistaError } = await queryLojista.single();

        if (lojistaError || !lojista) {
            console.error("Erro ao buscar lojista:", lojistaError);
            throw new Error(`Lojista não encontrado (ID: ${lojista_id}). Erro: ${lojistaError?.message}`);
        }

        const finalLojistaUserId = lojista.UserID;
        const nomeProposito = lojista.Proposito_Lojista;
        const totalVendasAtual = Number(lojista.total_vendas || 0);
        const totalDevolucaoAtual = Number(lojista.total_devolucao || 0);

        // Validação de Saldo do Lojista (Não pode devolver mais do que vendeu)
        if (totalVendasAtual < valorDevolucaoNum) {
            throw new Error(`Saldo insuficiente para realizar devolução. Vendas totais: R$ ${totalVendasAtual.toFixed(2)}, Tentativa de estorno: R$ ${valorDevolucaoNum.toFixed(2)}.`);
        }

        if (!nomeProposito) {
             throw new Error("Este lojista não possui um propósito configurado.");
        }

        // --- PASSO 1.5: Resolver Aluno ID (Bigint para UUID) ---
        let finalAlunoUserId = aluno_id;
        if (!isUUID(aluno_id)) {
            const { data: userRecord } = await supabaseClient
                .from('usuarios')
                .select('UserID')
                .eq('id', aluno_id)
                .single();
            
            if (userRecord?.UserID) {
                finalAlunoUserId = userRecord.UserID;
            } else {
                const { data: alunoRecord } = await supabaseClient
                    .from('aluno')
                    .select('user_id')
                    .eq('usuario_id', aluno_id)
                    .single();
                if (alunoRecord?.user_id) finalAlunoUserId = alunoRecord.user_id;
                else throw new Error("Não foi possível localizar o UserID do aluno.");
            }
        }

        // --- PASSO 2: Obter TODOS os propósitos do aluno (Estratégia 'Pega Tudo') ---
        const { data: todosPropositos, error: propError } = await supabaseClient
            .from('propositos')
            .select('id, saldo, nome')
            .eq('usuario_id', finalAlunoUserId)

        if (propError) {
             console.error("Erro ao buscar propósitos:", propError);
             throw new Error("Erro de banco ao buscar saldos do aluno.");
        }

        // Filtrar no Código - LÓGICA RIGOROSA (Normalizada)
        const targetNameNormalized = normalizeString(nomeProposito);
        
        const propositoAluno = todosPropositos?.find(p => {
            const dbNameNormalized = normalizeString(p.nome || '');
            return dbNameNormalized === targetNameNormalized;
        });

        if (!propositoAluno) {
             throw new Error(`Propósito '${nomeProposito}' não encontrado na conta do aluno.`);
        }

        // --- Tratar Saldo Atual ---
        const saldoRaw = String(propositoAluno.saldo || '0').trim(); 
        const saldoNormalizado = saldoRaw.replace(',', '.'); 
        const saldoAtual = parseFloat(saldoNormalizado);

        // --- PASSO 3: Executar a Transação (Devolução) ---
        
        // 3.1. Creditar no Aluno (Devolver dinheiro)
        const novoSaldoAluno = saldoAtual + valorDevolucaoNum; // SOMA
        
        const { error: updateAlunoError } = await supabaseClient
            .from('propositos')
            .update({ saldo: novoSaldoAluno.toString() }) 
            .eq('id', propositoAluno.id)

        if (updateAlunoError) {
             console.error("Erro Update Aluno:", updateAlunoError);
             throw new Error("Falha ao devolver saldo ao aluno.");
        }

        // 3.2. Atualizar Lojista (Debita Vendas, Soma Devolução)
        const novoTotalVendas = totalVendasAtual - valorDevolucaoNum; 
        const novoTotalDevolucao = totalDevolucaoAtual + valorDevolucaoNum;

        const { error: updateLojistaError } = await supabaseClient
            .from('usuarios')
            .update({ 
                total_vendas: novoTotalVendas,
                total_devolucao: novoTotalDevolucao 
            })
            .eq('id', lojista.id)
        
        if (updateLojistaError) {
             console.error("CRÍTICO: Aluno creditado mas falha ao atualizar vendas do lojista.", updateLojistaError);
        }

        // 3.3. Registrar Log da Transação
        const { data: alunoInfoLog } = await supabaseClient.from('aluno').select('id, nome').eq('user_id', finalAlunoUserId).maybeSingle();

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const currentMonth = monthNames[new Date().getMonth()];

        await supabaseClient.from('movimentacao_financeira').insert({
            aluno_id: alunoInfoLog?.id || null,
            tipo_operacao: 'DEVOLUCAO_LOJA',
            categoria: nomeProposito,
            nome_operacao: `Estorno de compra: ${lojista.nome}`,
            mes_operacao: currentMonth,
            status: 'CONCLUIDO',
            request_payload: { aluno_id: finalAlunoUserId, lojista_id: finalLojistaUserId, valor: valorDevolucaoNum, proposito: nomeProposito },
            response_payload: { 
                mensagem: `Devolução de loja: ${lojista.nome}`,
                valor_total: valorDevolucaoNum,
                aluno_nome: alunoInfoLog?.nome || "Aluno",
                novo_saldo_aluno: novoSaldoAluno,
                novo_total_vendas_lojista: novoTotalVendas
            },
            http_status: 200
        })

         // --- PASSO 5: Registrar Histórico Detalhado do Lojista ---
        try {
            const { data: userStats } = await supabaseClient
                .from('usuarios')
                .select('nome, turmaID')
                .eq('UserID', finalAlunoUserId)
                .single();
                
            let nomeTurma = "Sem Turma";
            if (userStats?.turmaID) {
                const { data: turmaInfo } = await supabaseClient
                    .from('turma')
                    .select('nome')
                    .eq('id', userStats.turmaID)
                    .single();
                if (turmaInfo?.nome) nomeTurma = turmaInfo.nome;
            }

            const nomeAluno = userStats?.nome || alunoInfoLog?.nome || "Aluno";

            await supabaseClient.from('lojista_historico').insert({
                lojista_id: finalLojistaUserId,
                aluno_id: finalAlunoUserId,
                aluno_nome: nomeAluno,
                aluno_turma: nomeTurma,
                valor: valorDevolucaoNum,
                tipo_operacao: 'DEVOLUCAO',
                saldo_vendas_pos: novoTotalVendas,
                descricao: `Devolução - ${nomeAluno} - ${nomeTurma}`
            });

        } catch(e) {
            console.error("Erro não-bloqueante ao gerar histórico:", e);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Devolução realizada com sucesso!",
            data: {
                proposito_nome: nomeProposito,
                lojista_nome: lojista.nome,
                valor_devolucao: valorDevolucaoNum,
                novo_saldo_aluno: novoSaldoAluno
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Refund Transaction:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
