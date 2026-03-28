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
        const aluno_id = body.aluno_id;

        if (!aluno_id) {
            throw new Error('aluno_id is required in JSON body');
        }

        // 1. Resolver o Aluno
        let queryAluno = supabaseClient.from('aluno').select('id, user_id, usuario_id');
        
        if (isUUID(String(aluno_id))) {
            queryAluno = queryAluno.or(`id.eq.${aluno_id},user_id.eq.${aluno_id}`);
        } else {
            // Se for número (ex: "162"), busca por usuario_id
            queryAluno = queryAluno.eq('usuario_id', aluno_id);
        }

        const { data: alunoData, error: errAluno } = await queryAluno.maybeSingle();

        if (errAluno) throw errAluno;
        if (!alunoData) {
            return new Response(JSON.stringify([]), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 2. Buscar Produtos na tabela produtos_aluno
        const { data: produtos, error: errProd } = await supabaseClient
            .from('produtos_aluno')
            .select('*')
            .eq('aluno_id', alunoData.id)
            .order('data_compra', { ascending: false });

        if (errProd) throw errProd;

        // 3. Padronizar o retorno para facilitar no FlutterFlow
        const formattedData = produtos.map(p => ({
            nome: p.nome_item,
            descricao: p.descricao,
            valor: p.valor_compra,
            imagem: p.imagem_url,
            quantidade: p.quantidade,
            status: p.status_item,
            data_compra: p.data_compra || p.data_acao
        }));

        return new Response(JSON.stringify(formattedData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
