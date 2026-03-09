import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
            // Tentativa 1: Padrão
            body = JSON.parse(rawBody);
        } catch (e: any) {
            // Tentativa 2: Corrigir "Vício Brasileiro" (ex: "valor": 10,50 -> a virgula quebra o JSON)
            // Regex: Busca por ": " seguido de dígitos, vírgula, dígitos (sem aspas em volta)
            // Ex: "valor": 10,50 -> "valor": 10.50
            const fixedBody = rawBody.replace(/:\s*(\d+),(\d+)/g, ': $1.$2');
            
            try {
                body = JSON.parse(fixedBody);
                console.warn("[WARN] JSON recuperado via sanitização de vírgulas.");
            } catch (e2: any) {
                console.error("Erro Parse JSON Final:", e2);
                throw new Error(`O JSON enviado está inválido. Se estiver enviando números decimais, use ponto (0.50) ou aspas ("0,50"). Erro Original: ${e.message}`);
            }
        }
        
        const { aluno_id, lojista_id, valor_debito } = body;

        // Validações Básicas
        if (!aluno_id || !lojista_id || valor_debito === undefined) {
            throw new Error("Parâmetros inválidos. Necessário: aluno_id, lojista_id e valor_debito.")
        }
        
        const valorDebitoNum = parseFloat(String(valor_debito).replace(',', '.')); // Aceita 2,50 ou 2.50

        // --- PASSO 1: Descobrir o Propósito do Lojista ---
        const { data: lojista, error: lojistaError } = await supabaseClient
            .from('usuarios')
            .select('Proposito_Lojista, nome')
            .eq('UserID', lojista_id) 
            .single()

        if (lojistaError || !lojista) {
            console.error("Erro ao buscar lojista:", lojistaError);
            throw new Error(`Lojista não encontrado (ID: ${lojista_id}). Erro: ${lojistaError?.message}`);
        }

        const nomeProposito = lojista.Proposito_Lojista; // Ex: 'Alimentação'

        if (!nomeProposito) {
             throw new Error("Este lojista não possui um propósito configurado (Proposito_Lojista).");
        }

        // --- PASSO 2: Buscar Saldo do Aluno NESTE Propósito ---
        const { data: todosPropositos, error: propError } = await supabaseClient
            .from('propositos')
            .select('saldo, nome')
            .eq('usuario_id', aluno_id)

        if (propError) {
             console.error("Erro ao buscar propósitos do aluno:", propError);
             throw new Error("Erro ao consultar saldo do aluno.");
        }

        // Normalizar string para comparação (remove acentos, lowercase)
        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const targetName = normalize(nomeProposito);
        
        const propositoAluno = todosPropositos?.find(p => normalize(p.nome || '') === targetName || normalize(p.nome || '').includes(targetName));

        let saldoAtual = 0;
        let temSaldo = false;

        if (propositoAluno) {
            // Converter saldo
            const saldoRaw = String(propositoAluno.saldo || '0').trim(); 
            saldoAtual = parseFloat(saldoRaw.replace(',', '.'));    
        } else {
            console.warn(`Aluno ${aluno_id} não possui o propósito '${nomeProposito}' (Lojista). Assumindo saldo 0.`);
        }

        // --- PASSO 3: Calcular Preview ---
        const novoSaldo = saldoAtual - valorDebitoNum;
        temSaldo = novoSaldo >= 0;

        return new Response(JSON.stringify({ 
            success: true, 
            data: {
                proposito_nome: nomeProposito,
                lojista_nome: lojista.nome,
                saldo_atual: saldoAtual,
                valor_debito: valorDebitoNum,
                novo_saldo: novoSaldo,
                saldo_suficiente: temSaldo
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Function Calculation:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})