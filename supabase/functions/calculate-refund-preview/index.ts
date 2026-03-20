import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// FunÃ§Ã£o de normalizaÃ§Ã£o para busca exata (importante!)
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
        const { aluno_id, lojista_id, valor_devolucao } = body; // Aceita 'valor_devolucao'

        // ValidaÃ§Ãµes
        if (!aluno_id || !lojista_id || valor_devolucao === undefined) {
            throw new Error("ParÃ¢metros invÃ¡lidos. NecessÃ¡rio: aluno_id, lojista_id, valor_devolucao.")
        }

        const valorDevolucaoNum = parseFloat(String(valor_devolucao).replace(',', '.')); // Aceita 2,50 ou 2.50

        // --- PASSO 1: Descobrir o PropÃ³sito do Lojista ---
        const { data: lojista, error: lojistaError } = await supabaseClient
            .from('usuarios')
            .select('Proposito_Lojista, nome')
            .eq('UserID', lojista_id)
            .single()

        if (lojistaError || !lojista) {
            console.error("Erro ao buscar lojista:", lojistaError);
            throw new Error(`Lojista nÃ£o encontrado (ID: ${lojista_id}). Erro: ${lojistaError?.message}`);
        }

        const nomeProposito = lojista.Proposito_Lojista;

        if (!nomeProposito) {
            throw new Error("Este lojista nÃ£o possui um propÃ³sito configurado (Proposito_Lojista).");
        }

        // --- PASSO 2: Buscar TODOS os Saldos do Aluno (EstratÃ©gia Robusta) ---
        const { data: todosPropositos, error: propError } = await supabaseClient
            .from('propositos')
            .select('saldo, nome')
            .eq('usuario_id', aluno_id)

        if (propError) {
            console.error("Erro ao buscar propÃ³sitos do aluno:", propError);
            throw new Error("Erro ao consultar saldo do aluno.");
        }

        // LÃ³gica de Busca Exata (Normalizada)
        const targetNameNormalized = normalizeString(nomeProposito);

        const propositoAluno = todosPropositos?.find(p => {
            const dbNameNormalized = normalizeString(p.nome || '');
            return dbNameNormalized === targetNameNormalized;
        });

        let saldoAtual = 0;

        if (propositoAluno) {
            const saldoRaw = String(propositoAluno.saldo || '0').trim();
            saldoAtual = parseFloat(saldoRaw.replace(',', '.'));
        } else {
            console.warn(`Aluno ${aluno_id} nÃ£o possui o propÃ³sito '${nomeProposito}' (Lojista). Assumindo saldo 0.`);
            // Opcional: Se quiser que dÃª erro se nÃ£o achar, descomente abaixo.
            //Mas numa devoluÃ§Ã£o talvez queiramos mostrar 0 mesmo.
            saldoAtual = 0;
        }

        // --- PASSO 3: Calcular Preview (SOMA) ---
        const novoSaldo = saldoAtual + valorDevolucaoNum;

        return new Response(JSON.stringify({
            success: true,
            data: {
                proposito_nome: nomeProposito,
                lojista_nome: lojista.nome,
                saldo_atual: saldoAtual,
                valor_a_creditar: valorDevolucaoNum, // Valor que serÃ¡ devolvido
                novo_saldo: novoSaldo // Saldo final previsto
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Refund Preview:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
