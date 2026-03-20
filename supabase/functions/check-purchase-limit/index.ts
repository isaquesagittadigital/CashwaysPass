import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper func
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
        
        const { aluno_id, produto_id } = body;

        if (!aluno_id || !produto_id) {
            throw new Error("ParÃ¢metros 'aluno_id' e 'produto_id' sÃ£o obrigatÃ³rios.")
        }

        // --- PASSO 1: Identificar Aluno ---
        let queryAluno = supabaseClient.from('aluno').select('id');
        if (isUUID(aluno_id)) {
            queryAluno = queryAluno.or(`id.eq.${aluno_id},user_id.eq.${aluno_id}`);
        } else {
            queryAluno = queryAluno.eq('usuario_id', aluno_id);
        }

        const { data: alunoData, error: alunoError } = await queryAluno.maybeSingle();

        if (alunoError || !alunoData) {
            throw new Error(`Aluno nÃ£o encontrado no sistema.`);
        }

        const realAlunoId = alunoData.id;

        // --- PASSO 2: Obter limite do produto ---
        const { data: dbProd, error: prodError } = await supabaseClient
            .from('produto')
            .select('limete_por_aluno')
            .eq('id', produto_id)
            .single();

        if (prodError || !dbProd) {
            throw new Error(`Produto nÃ£o encontrado.`);
        }

        const maxLimit = dbProd.limete_por_aluno;

        // --- PASSO 3: Consultar quantidade jÃ¡ comprada ---
        const { data: pastPurchases, error: pastError } = await supabaseClient
            .from('produtos_aluno')
            .select('quantidade')
            .eq('aluno_id', realAlunoId)
            .eq('produto_id', produto_id);

        let qtdJaComprada = 0;
        if (!pastError && pastPurchases && pastPurchases.length > 0) {
            qtdJaComprada = pastPurchases.reduce((acc, curr) => acc + (curr.quantidade || 1), 0);
        }

        // --- PASSO 4: Resultado final ---
        let limitReached = false;
        let allowedToBuyMore = true;
        let remaining = null; // null se nÃ£o houver limite

        if (maxLimit !== null && maxLimit !== undefined && typeof maxLimit === 'number') {
            remaining = Math.max(0, maxLimit - qtdJaComprada);
            if (qtdJaComprada >= maxLimit) {
                limitReached = true;
                allowedToBuyMore = false;
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            data: {
                limit_reached: limitReached,
                allowed_to_buy_more: allowedToBuyMore,
                max_limit: maxLimit,
                current_purchased: qtdJaComprada,
                remaining_allowed: remaining
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Check Purchase Limit:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

