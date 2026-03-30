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
        const authHeader = req.headers.get('Authorization');
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
        );

        const rawBody = (await req.text()).trim();
        let body: any = {};
        let inputId: string | null = null;
        
        try {
            if (rawBody) {
                // Remove caracteres invisíveis e tenta parsear
                const sanitizedBody = rawBody.replace(/^\uFEFF/, '').trim();
                body = JSON.parse(sanitizedBody);
                inputId = body.UserID || body.user_id || body.aluno_id;
            }
        } catch (e: any) {
            console.error("Erro no parse do JSON. Tentando extração por Texto/Regex.");
            
            // Tenta extrair o ID via Regex (muito útil se o JSON estiver quebrado como no FlutterFlow)
            // Busca por: "UserID": "XXXX" ou "aluno_id": "XXXX" etc
            const regexID = /(?:UserID|user_id|aluno_id)["\s:]+["']?([0-9a-fA-F-]{36}|[0-9]+)["']?/i;
            const match = rawBody.match(regexID);
            
            if (match && match[1]) {
                inputId = match[1];
                console.log("ID extraído via Regex com sucesso:", inputId);
            } else {
                throw new Error(`JSON Inválido e Falha na extração de ID. Recebido: ${rawBody}`);
            }
        }

        if (!inputId) {
            throw new Error(`UserID ou aluno_id não encontrado no corpo. Chaves presentes: ${Object.keys(body).join(', ') || 'Nenhuma'}. Recebido: ${rawBody}`);
        }

        // 1. Resolver o Aluno
        let queryAluno = supabaseClient.from('aluno').select('id, user_id, usuario_id');
        
        if (isUUID(String(inputId))) {
            // Tenta encontrar por aluno.id OU aluno.user_id (Auth UUID)
            queryAluno = queryAluno.or(`id.eq.${inputId},user_id.eq.${inputId}`);
        } else {
            // Se for número (ex: "162"), busca por usuario_id (Integer PK de usuarios)
            queryAluno = queryAluno.eq('usuario_id', inputId);
        }

        const { data: alunoData, error: errAluno } = await queryAluno.maybeSingle();

        if (errAluno) throw errAluno;
        if (!alunoData) {
            return new Response(JSON.stringify([]), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 2. Buscar Produtos na tabela produtos_aluno (Apenas os que não foram usados/resgatados ainda)
        const { data: produtos, error: errProd } = await supabaseClient
            .from('produtos_aluno')
            .select('*')
            .eq('aluno_id', alunoData.id)
            .eq('status_item', 'Comprado')
            .order('data_compra', { ascending: false });

        if (errProd) throw errProd;

        // 3. Padronizar o retorno para facilitar no FlutterFlow
        const formattedData = produtos.map(p => ({
            id: p.id,
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
