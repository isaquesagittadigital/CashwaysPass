import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

        // --- PASSO 1: Identificar Aluno ---
        let queryAluno = supabaseClient.from('aluno').select('id, nome');
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

        // --- PASSO 2: Consultar logs financeiros do aluno ---
        const { data: fetchLogs, error: logError } = await supabaseClient
            .from('movimentacao_financeira')
            .select('id, created_date, tipo_operacao, status, response_payload')
            .eq('aluno_id', realAlunoId)
            .order('created_date', { ascending: false });

        if (logError) {
            throw new Error(`Erro ao buscar logs financeiros: ${logError.message}`);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Logs financeiros recuperados com sucesso.",
            data: fetchLogs
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro list-financial-logs:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

