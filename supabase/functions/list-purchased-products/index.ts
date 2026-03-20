import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper funcs
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
        
        const { aluno_id } = body;

        if (!aluno_id) {
            throw new Error("ParÃ¢metro 'aluno_id' Ã© obrigatÃ³rio.")
        }

        // Busca aluno real (caso tenha sido passado o user_id da auth ou usuario_id numÃ©rico)
        let query = supabaseClient.from('aluno').select('id, nome');
        if (isUUID(aluno_id)) {
            query = query.or(`id.eq.${aluno_id},user_id.eq.${aluno_id}`);
        } else {
            query = query.eq('usuario_id', aluno_id);
        }

        const { data: alunoData, error: alunoError } = await query.maybeSingle();

        if (alunoError || !alunoData) {
            throw new Error(`Aluno nÃ£o encontrado no sistema.`);
        }

        const realAlunoId = alunoData.id;

        // Busca produtos comprados
        const { data: produtosComprados, error: prodError } = await supabaseClient
            .from('produtos_aluno')
            .select('id, produto_id, nome_item, descricao, imagem_url, valor_compra, quantidade, data_compra, status_item, data_acao')
            .eq('aluno_id', realAlunoId)
            .eq('status_item', 'Comprado')
            .order('data_compra', { ascending: false });

        if (prodError) {
            throw new Error(`Erro ao buscar produtos: ${prodError.message}`);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Produtos resgatados com sucesso.",
            data: produtosComprados
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro List Purchased Products:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

