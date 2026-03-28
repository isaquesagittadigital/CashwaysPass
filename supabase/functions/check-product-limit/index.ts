import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isUUID(str: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const body = await req.json();
        const { aluno_id, produto_id } = body;

        if (!aluno_id || !produto_id) {
            throw new Error('aluno_id and produto_id are required in JSON body');
        }

        // 1. Resolver o Aluno
        let queryAluno = supabaseClient.from('aluno').select('id, user_id, usuario_id');
        const strId = String(aluno_id);

        if (isUUID(strId)) {
            queryAluno = queryAluno.or(`id.eq.${strId},user_id.eq.${strId}`);
        } else {
            const numId = parseInt(strId);
            if (!isNaN(numId)) {
                queryAluno = queryAluno.eq('usuario_id', numId);
            }
        }

        const { data: alunoData, error: errAluno } = await queryAluno.maybeSingle();
        if (errAluno || !alunoData) throw new Error('Aluno não encontrado.');

        // 2. Buscar limite do produto
        const { data: produto, error: errProd } = await supabaseClient
            .from('produto')
            .select('id, nome, limete_por_aluno')
            .eq('id', produto_id)
            .single();

        if (errProd || !produto) throw new Error('Produto não encontrado.');

        const limit = produto.limete_por_aluno;

        // 3. Contar compras já realizadas (usadas ou não)
        const { data: compras, error: errCompras } = await supabaseClient
            .from('produtos_aluno')
            .select('quantidade')
            .eq('aluno_id', alunoData.id)
            .eq('produto_id', produto.id);

        if (errCompras) throw errCompras;

        const currentCount = (compras || []).reduce((acc, curr) => acc + (curr.quantidade || 1), 0);

        // 4. Calcular resultado
        const hasLimit = limit !== null && limit !== undefined;
        const canPurchase = hasLimit ? currentCount < limit : true;
        const remaining = hasLimit ? Math.max(0, limit - currentCount) : 9999;

        return new Response(JSON.stringify({
            success: true,
            data: {
                produto_nome: produto.nome,
                can_purchase: canPurchase,
                limit: hasLimit ? limit : "Ilimitado",
                current_count: currentCount,
                remaining: remaining
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
