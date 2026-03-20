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
        const { aluno_id, lojista_id, valor_debito, proposito_nome } = body;

        // ValidaÃ§Ãµes
        if (!aluno_id || !lojista_id || !proposito_nome || valor_debito === undefined) {
            throw new Error("ParÃ¢metros invÃ¡lidos. NecessÃ¡rio: aluno_id, lojista_id, proposito_nome e valor_debito.")
        }
        
        const valorDebitoNum = parseFloat(String(valor_debito).replace(',', '.')); // Aceita 2,50 ou 2.50

        console.log(`[DEBUG] Iniciando TransaÃ§Ã£o. Aluno: ${aluno_id}, Valor: ${valorDebitoNum}, PropÃ³sito Alvo: ${proposito_nome}`);

        // --- PASSO 1: Obter Dados do Lojista (Apenas Nome e Total Vendas) ---
        const { data: lojista, error: lojistaError } = await supabaseClient
            .from('usuarios')
            .select('nome, total_vendas')
            .eq('UserID', lojista_id)
            .single()

        if (lojistaError || !lojista) {
            console.error("Erro ao buscar lojista:", lojistaError);
            throw new Error(`Lojista nÃ£o encontrado (ID: ${lojista_id}). Verifique se o ID estÃ¡ correto.`);
        }
        const totalVendasAtual = Number(lojista.total_vendas || 0);

        // --- PASSO 2: Obter TODOS os propÃ³sitos do aluno (EstratÃ©gia 'Pega Tudo') ---
        const { data: todosPropositos, error: propError } = await supabaseClient
            .from('propositos')
            .select('id, saldo, nome')
            .eq('usuario_id', aluno_id)

        if (propError) {
             console.error("Erro ao buscar propÃ³sitos:", propError);
             throw new Error("Erro de banco ao buscar saldos.");
        }

        // --- LOG CRIITICO PRA DIAGNÃ“STICO DO USUÃRIO ---
        // VÃª o que de fato veio do banco
        console.log(`[DEBUG] Total PropÃ³sitos: ${todosPropositos?.length || 0}. Lista:`, 
            JSON.stringify(todosPropositos?.map(p => ({ nome: p.nome, saldoRaw: p.saldo }))));

        // Filtrar no CÃ³digo - LÃ“GICA RIGOROSA (Identica ao Preview)
        const targetNameNormalized = normalizeString(proposito_nome);
        
        // Tentativa 1: Busca Exata (Prioridade MÃ¡xima)
        const propositoAluno = todosPropositos?.find(p => {
            const dbNameNormalized = normalizeString(p.nome || '');
            return dbNameNormalized === targetNameNormalized;
        });

        if (!propositoAluno) {
             // Lista o que temos de disponÃ­vel para ajudar a debugar
             const nomesDisponiveis = todosPropositos?.map(p => `${p.nome} (Saldo: ${p.saldo})`).join(', ');
             
             throw new Error(`PropÃ³sito '${proposito_nome}' nÃ£o encontrado na conta do aluno. Seus propÃ³sitos sÃ£o: ${nomesDisponiveis || 'Nenhum'}`);
        }

        // --- Tratar Saldo ---
        // Garante que 1.50 nÃ£o vire 150 nem 0
        const saldoRaw = String(propositoAluno.saldo || '0').trim(); 
        const saldoNormalizado = saldoRaw.replace(',', '.'); 
        const saldoAtual = parseFloat(saldoNormalizado);

        console.log(`[DEBUG] MATCH SUCESSO! PropÃ³sito: ${propositoAluno.nome} (ID: ${propositoAluno.id}) | Saldo Banco: '${saldoRaw}' -> Parse: ${saldoAtual}`);

        // --- PASSO 3: Verificar Saldo ---
        if (saldoAtual < valorDebitoNum) {
            // Log especial para entender por que falhou
            throw new Error(`Saldo insuficiente no propÃ³sito '${propositoAluno.nome}'. VocÃª tem R$ ${saldoAtual.toFixed(2)} e tentou gastar R$ ${valorDebitoNum.toFixed(2)}.`);
        }

        // --- PASSO 4: Executar TransaÃ§Ã£o ---
        const novoSaldoAluno = saldoAtual - valorDebitoNum;

        // Atualiza Aluno
        const { error: updateAlunoError } = await supabaseClient
            .from('propositos')
            .update({ saldo: novoSaldoAluno.toString() }) 
            .eq('id', propositoAluno.id)

        if (updateAlunoError) {
             throw new Error("Erro ao atualizar saldo do aluno: " + updateAlunoError.message);
        }

        // Atualiza Lojista (contador de vendas)
        const novoTotalVendas = totalVendasAtual + valorDebitoNum;
        await supabaseClient
            .from('usuarios')
            .update({ total_vendas: novoTotalVendas })
            .eq('UserID', lojista_id)

        // Log Transfeera
        const { data: alunoInfoLog } = await supabaseClient.from('aluno').select('id, nome').eq('user_id', aluno_id).maybeSingle();

        await supabaseClient.from('movimentacao_financeira').insert({
            aluno_id: alunoInfoLog?.id || null,
            tipo_operacao: 'COMPRA_LOJA',
            status: 'CONCLUIDO',
            request_payload: { aluno_id, lojista_id, valor: valorDebitoNum, proposito_nome },
            response_payload: { 
                mensagem: `Compra no balcÃ£o: ${lojista.nome}`,
                item: "Pagamento Manual Gestor",
                valor_total: valorDebitoNum,
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
            const descricaoHistorico = `Venda - ${nomeAluno} - ${nomeTurma}`;

            // 5.2. Inserir no HistÃ³rico
            const { error: histError } = await supabaseClient
                .from('lojista_historico')
                .insert({
                    lojista_id: lojista_id,
                    aluno_id: aluno_id,
                    aluno_nome: nomeAluno,
                    aluno_turma: nomeTurma,
                    valor: valorDebitoNum,
                    tipo_operacao: 'VENDA',
                    saldo_vendas_pos: novoTotalVendas,
                    descricao: descricaoHistorico
                });

            if (histError) console.error("Erro ao gravar histÃ³rico detalhado:", histError);

        } catch(e) {
            console.error("Erro nÃ£o-bloqueante ao gerar histÃ³rico:", e);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Compra realizada com sucesso!",
            data: {
                proposito_nome: propositoAluno.nome,
                lojista_nome: lojista.nome,
                valor_debito: valorDebitoNum,
                novo_saldo_aluno: novoSaldoAluno
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Confirm Transaction:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
