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
        const { aluno_id, lojista_id, valor_debito, proposito_nome } = body;

        // Validações
        if (!aluno_id || !lojista_id || !proposito_nome || valor_debito === undefined) {
            throw new Error("Parâmetros inválidos. Necessário: aluno_id, lojista_id, proposito_nome e valor_debito.")
        }
        
        const valorDebitoNum = parseFloat(String(valor_debito).replace(',', '.')); // Aceita 2,50 ou 2.50

        console.log(`[DEBUG] Iniciando Transação. Aluno: ${aluno_id}, Valor: ${valorDebitoNum}, Propósito Alvo: ${proposito_nome}`);

        // --- PASSO 1: Obter Dados do Lojista (Apenas Nome e Total Vendas) ---
        const { data: lojista, error: lojistaError } = await supabaseClient
            .from('usuarios')
            .select('nome, total_vendas')
            .eq('UserID', lojista_id)
            .single()

        if (lojistaError || !lojista) {
            console.error("Erro ao buscar lojista:", lojistaError);
            throw new Error(`Lojista não encontrado (ID: ${lojista_id}). Verifique se o ID está correto.`);
        }
        const totalVendasAtual = Number(lojista.total_vendas || 0);

        // --- PASSO 2: Obter TODOS os propósitos do aluno (Estratégia 'Pega Tudo') ---
        const { data: todosPropositos, error: propError } = await supabaseClient
            .from('propositos')
            .select('id, saldo, nome')
            .eq('usuario_id', aluno_id)

        if (propError) {
             console.error("Erro ao buscar propósitos:", propError);
             throw new Error("Erro de banco ao buscar saldos.");
        }

        // --- LOG CRIITICO PRA DIAGNÓSTICO DO USUÁRIO ---
        // Vê o que de fato veio do banco
        console.log(`[DEBUG] Total Propósitos: ${todosPropositos?.length || 0}. Lista:`, 
            JSON.stringify(todosPropositos?.map(p => ({ nome: p.nome, saldoRaw: p.saldo }))));

        // Filtrar no Código - LÓGICA RIGOROSA (Identica ao Preview)
        const targetNameNormalized = normalizeString(proposito_nome);
        
        // Tentativa 1: Busca Exata (Prioridade Máxima)
        const propositoAluno = todosPropositos?.find(p => {
            const dbNameNormalized = normalizeString(p.nome || '');
            return dbNameNormalized === targetNameNormalized;
        });

        if (!propositoAluno) {
             // Lista o que temos de disponível para ajudar a debugar
             const nomesDisponiveis = todosPropositos?.map(p => `${p.nome} (Saldo: ${p.saldo})`).join(', ');
             
             throw new Error(`Propósito '${proposito_nome}' não encontrado na conta do aluno. Seus propósitos são: ${nomesDisponiveis || 'Nenhum'}`);
        }

        // --- Tratar Saldo ---
        // Garante que 1.50 não vire 150 nem 0
        const saldoRaw = String(propositoAluno.saldo || '0').trim(); 
        const saldoNormalizado = saldoRaw.replace(',', '.'); 
        const saldoAtual = parseFloat(saldoNormalizado);

        console.log(`[DEBUG] MATCH SUCESSO! Propósito: ${propositoAluno.nome} (ID: ${propositoAluno.id}) | Saldo Banco: '${saldoRaw}' -> Parse: ${saldoAtual}`);

        // --- PASSO 3: Verificar Saldo ---
        if (saldoAtual < valorDebitoNum) {
            // Log especial para entender por que falhou
            throw new Error(`Saldo insuficiente no propósito '${propositoAluno.nome}'. Você tem R$ ${saldoAtual.toFixed(2)} e tentou gastar R$ ${valorDebitoNum.toFixed(2)}.`);
        }

        // --- PASSO 4: Executar Transação ---
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
        await supabaseClient.from('transfeera_log').insert({
            tipo_operacao: 'COMPRA_LOJA',
            status: 'SUCESSO',
            request_payload: { aluno_id, lojista_id, valor: valorDebitoNum, proposito_nome },
            response_payload: { 
                mensagem: `Compra realizada em ${lojista.nome} (${propositoAluno.nome})`,
                novo_saldo_aluno: novoSaldoAluno,
                novo_total_vendas_lojista: novoTotalVendas
            },
            http_status: 200
        })

         // --- PASSO 5: Registrar Histórico Detalhado do Lojista ---
        try {
            // 5.1. Buscar dados do aluno para o histórico
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

            // 5.2. Inserir no Histórico
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

            if (histError) console.error("Erro ao gravar histórico detalhado:", histError);

        } catch(e) {
            console.error("Erro não-bloqueante ao gerar histórico:", e);
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