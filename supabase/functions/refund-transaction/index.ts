import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// FunÃ§Ã£o auxiliar para normalizar strings (remover acentos e lowercase)
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
            // Tentativa 2: Corrigir "VÃ­cio Brasileiro" (ex: "valor": 10,50 -> a virgula quebra o JSON)
            const fixedBody = rawBody.replace(/:\s*(\d+),(\d+)/g, ': $1.$2');
            try {
                body = JSON.parse(fixedBody);
                console.warn("[WARN] JSON recuperado via sanitizaÃ§Ã£o de vÃ­rgulas.");
            } catch (e2: any) {
                console.error("Erro Parse JSON Final:", e2);
                throw new Error(`O JSON enviado estÃ¡ invÃ¡lido. Se estiver enviando nÃºmeros decimais, use ponto (0.50) ou aspas ("0,50"). Erro: ${e.message}`);
            }
        }
        const { aluno_id, lojista_id, valor_devolucao } = body;

        // ValidaÃ§Ãµes BÃ¡sicas
        if (!aluno_id || !lojista_id || valor_devolucao === undefined || valor_devolucao <= 0) {
            throw new Error("ParÃ¢metros invÃ¡lidos. NecessÃ¡rio: aluno_id, lojista_id, valor_devolucao (>0).")
        }
        
        const valorDevolucaoNum = parseFloat(String(valor_devolucao).replace(',', '.')); // Aceita 2,50 ou 2.50

        console.log(`[DEBUG] Iniciando DevoluÃ§Ã£o. Aluno: ${aluno_id}, Valor: ${valorDevolucaoNum}`);

        // --- PASSO 1: Obter Dados do Lojista (PropÃ³sito e Total Vendas) ---
        const { data: lojista, error: lojistaError } = await supabaseClient
            .from('usuarios')
            .select('Proposito_Lojista, nome, total_vendas, total_devolucao')
            .eq('UserID', lojista_id)
            .single()

        if (lojistaError || !lojista) {
            console.error("Erro ao buscar lojista:", lojistaError);
            throw new Error(`Lojista nÃ£o encontrado (ID: ${lojista_id}). Verifique se o ID estÃ¡ correto.`);
        }

        const nomeProposito = lojista.Proposito_Lojista;
        const totalVendasAtual = Number(lojista.total_vendas || 0);
        const totalDevolucaoAtual = Number(lojista.total_devolucao || 0);

        // ValidaÃ§Ã£o de Saldo do Lojista
        if (totalVendasAtual < valorDevolucaoNum) {
            throw new Error(`Saldo insuficiente para realizar devoluÃ§Ã£o. VocÃª possui R$ ${totalVendasAtual.toFixed(2)} em vendas e tentou devolver R$ ${valorDevolucaoNum.toFixed(2)}.`);
        }

        if (!nomeProposito) {
             throw new Error("Este lojista nÃ£o possui um propÃ³sito configurado, impossÃ­vel identificar onde devolver o saldo.");
        }

        // --- PASSO 2: Obter TODOS os propÃ³sitos do aluno (EstratÃ©gia 'Pega Tudo') ---
        const { data: todosPropositos, error: propError } = await supabaseClient
            .from('propositos')
            .select('id, saldo, nome')
            .eq('usuario_id', aluno_id)

        if (propError) {
             console.error("Erro ao buscar propÃ³sitos:", propError);
             throw new Error("Erro de banco ao buscar saldos do aluno.");
        }

        // Filtrar no CÃ³digo - LÃ“GICA RIGOROSA (Identica ao Confirm Transaction)
        const targetNameNormalized = normalizeString(nomeProposito);
        
        // Tentativa 1: Busca Exata (Prioridade MÃ¡xima)
        const propositoAluno = todosPropositos?.find(p => {
            const dbNameNormalized = normalizeString(p.nome || '');
            return dbNameNormalized === targetNameNormalized;
        });

        if (!propositoAluno) {
             // Lista o que temos de disponÃ­vel para ajudar a debugar
             const nomesDisponiveis = todosPropositos?.map(p => `${p.nome} (Saldo: ${p.saldo})`).join(', ');
             throw new Error(`PropÃ³sito '${nomeProposito}' (do Lojista) nÃ£o encontrado na conta do aluno. Seus propÃ³sitos sÃ£o: ${nomesDisponiveis || 'Nenhum'}`);
        }

        // --- Tratar Saldo Atual ---
        const saldoRaw = String(propositoAluno.saldo || '0').trim(); 
        const saldoNormalizado = saldoRaw.replace(',', '.'); 
        const saldoAtual = parseFloat(saldoNormalizado);

        console.log(`[DEBUG] PropÃ³sito Encontrado: ${propositoAluno.nome} (ID: ${propositoAluno.id}) | Saldo Atual: ${saldoAtual}`);

        // --- PASSO 3: Executar a TransaÃ§Ã£o (DevoluÃ§Ã£o) ---
        
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

        // 3.2. Atualizar Lojista (Debita Vendas, Soma DevoluÃ§Ã£o)
        const novoTotalVendas = totalVendasAtual - valorDevolucaoNum; 
        const novoTotalDevolucao = totalDevolucaoAtual + valorDevolucaoNum;

        const { error: updateLojistaError } = await supabaseClient
            .from('usuarios')
            .update({ 
                total_vendas: novoTotalVendas,
                total_devolucao: novoTotalDevolucao 
            })
            .eq('UserID', lojista_id)
        
        if (updateLojistaError) {
             console.error("CRÃTICO: Aluno creditado mas falha ao atualizar vendas do lojista.", updateLojistaError);
        }

        // 3.3. Registrar Log da TransaÃ§Ã£o
        const { data: alunoInfoLog } = await supabaseClient.from('aluno').select('id, nome').eq('user_id', aluno_id).maybeSingle();

        await supabaseClient.from('movimentacao_financeira').insert({
            aluno_id: alunoInfoLog?.id || null,
            tipo_operacao: 'DEVOLUCAO_LOJA', // Tipo EspecÃ­fico
            status: 'CONCLUIDO',
            request_payload: { aluno_id, lojista_id, valor: valorDevolucaoNum, proposito: nomeProposito },
            response_payload: { 
                mensagem: `DevoluÃ§Ã£o de loja: ${lojista.nome}`,
                item: "Estorno GestÃ£o",
                valor_total: valorDevolucaoNum,
                aluno_nome: alunoInfoLog?.nome || "Aluno",
                novo_saldo_aluno: novoSaldoAluno,
                novo_total_vendas_lojista: novoTotalVendas
            },
            http_status: 200
        })

         // --- PASSO 5: Registrar HistÃ³rico Detalhado do Lojista ---
        try {
            // 5.1. Buscar dados do aluno para o histÃ³rico
            const { data: alunoInfo } = await supabaseClient
                .from('usuarios')
                .select('nome, turmaID')
                .eq('UserID', aluno_id)
                .single();
                
            let nomeTurma = "Sem Turma";
            if (alunoInfo?.turmaID) {
                const { data: turmaInfo } = await supabaseClient
                    .from('turma')
                    .select('nome')
                    .eq('id', alunoInfo.turmaID)
                    .single();
                if (turmaInfo?.nome) nomeTurma = turmaInfo.nome;
            }

            const nomeAluno = alunoInfo?.nome || "Aluno Desconhecido";
            const descricaoHistorico = `DevoluÃ§Ã£o - ${nomeAluno} - ${nomeTurma}`;

            // 5.2. Inserir no HistÃ³rico
            const { error: histError } = await supabaseClient
                .from('lojista_historico')
                .insert({
                    lojista_id: lojista_id,
                    aluno_id: aluno_id,
                    aluno_nome: nomeAluno,
                    aluno_turma: nomeTurma,
                    valor: valorDevolucaoNum,
                    tipo_operacao: 'DEVOLUCAO',
                    saldo_vendas_pos: novoTotalVendas,
                    descricao: descricaoHistorico
                });

            if (histError) console.error("Erro ao gravar histÃ³rico detalhado:", histError);

        } catch(e) {
            console.error("Erro nÃ£o-bloqueante ao gerar histÃ³rico:", e);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: "DevoluÃ§Ã£o realizada com sucesso!",
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
