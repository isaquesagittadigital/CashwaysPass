import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let targetId: string | null = null;
        let authHeader = req.headers.get('Authorization');

        if (authHeader) {
            const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
            if (user) targetId = user.id;
        }

        if (!targetId) {
            const body = await req.json().catch(() => ({}));
            targetId = body.user_id || body.id || body.escola_id;
        }

        if (!targetId) throw new Error("ID não informado (user_id ou escola_id).");

        console.log(`[INVESTED_TOTAL] Analisando ID: ${targetId}`);

        // 1. Identificar Entidade (Usuário ou Escola)
        const [{ data: userRecord }, { data: schoolRecord }] = await Promise.all([
            supabaseAdmin.from('usuarios').select('nome_completo, UserID').eq('UserID', targetId).maybeSingle(),
            supabaseAdmin.from('escola').select('nome_fantasia, id').eq('id', targetId).maybeSingle()
        ]);

        let totalInvested = 0;
        let scope = "unknown";
        let entityName = "Não encontrado";
        const opTypes = ['RECARGA_PIX', 'ADICAO_MANUAL'];

        if (userRecord) {
            scope = "user";
            entityName = userRecord.nome_completo;
            
            const { data: movements } = await supabaseAdmin
                .from('movimentacao_financeira')
                .select('valor')
                .eq('aluno_id', targetId)
                .in('tipo_operacao', opTypes)
                .eq('status', 'CONCLUIDO');

            movements?.forEach(m => {
                totalInvested += parseFloat(String(m.valor || '0'));
            });

        } else if (schoolRecord) {
            scope = "school";
            entityName = schoolRecord.nome_fantasia;
            
            // Busca todos os IDs de usuários daquela escola
            const { data: users } = await supabaseAdmin
                .from('usuarios')
                .select('UserID')
                .eq('escola_id', targetId);

            const userIds = (users || []).map(u => u.UserID).filter(Boolean);

            if (userIds.length > 0) {
                // Soma movimentações bem-sucedidas de todos os usuários da escola
                const { data: movements } = await supabaseAdmin
                    .from('movimentacao_financeira')
                    .select('valor')
                    .in('aluno_id', userIds)
                    .in('tipo_operacao', opTypes)
                    .eq('status', 'CONCLUIDO');

                movements?.forEach(m => {
                    totalInvested += parseFloat(String(m.valor || '0'));
                });
            }

        } else {
            throw new Error(`O ID ${targetId} não foi reconhecido como Usuário nem como Escola.`);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            id: targetId,
            scope,
            entity_name: entityName,
            total_invested: Number(totalInvested.toFixed(2)),
            operation_types: opTypes
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
