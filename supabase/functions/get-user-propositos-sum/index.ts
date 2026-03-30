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

        console.log(`[PROPOSITOS_SUM] Analisando ID: ${targetId}`);

        // 1. Identificar se o ID é de um USUÁRIO ou de uma ESCOLA
        const [{ data: userRecord }, { data: schoolRecord }] = await Promise.all([
            supabaseAdmin.from('usuarios').select('nome_completo, UserID').eq('UserID', targetId).maybeSingle(),
            supabaseAdmin.from('escola').select('nome_fantasia, id').eq('id', targetId).maybeSingle()
        ]);

        let totalSum = 0;
        let count = 0;
        let scope = "unknown";
        let entityName = "Não encontrado";
        let details: any[] = [];

        if (userRecord) {
            scope = "user";
            entityName = userRecord.nome_completo;
            const { data: props } = await supabaseAdmin.from('propositos').select('saldo, nome').eq('usuario_id', targetId);
            
            (props || []).forEach(p => {
                const val = parseFloat(String(p.saldo || '0').replace(',', '.'));
                totalSum += isNaN(val) ? 0 : val;
                details.push({ nome: p.nome, saldo: val });
            });
            count = details.length;

        } else if (schoolRecord) {
            scope = "school";
            entityName = schoolRecord.nome_fantasia;
            
            // 2. Fluxo Escola: Busca todos os usuarios daquela escola
            const { data: schoolUsers } = await supabaseAdmin
                .from('usuarios')
                .select('UserID')
                .eq('escola_id', targetId);

            const userIds = (schoolUsers || []).map(u => u.UserID).filter(Boolean);

            if (userIds.length > 0) {
                // 3. Busca todos os propósitos dos usuários da escola
                const { data: props } = await supabaseAdmin
                    .from('propositos')
                    .select('saldo')
                    .in('usuario_id', userIds);

                (props || []).forEach(p => {
                    const val = parseFloat(String(p.saldo || '0').replace(',', '.'));
                    totalSum += isNaN(val) ? 0 : val;
                });
                count = props?.length || 0;
            }
            details = []; // Consolidado

        } else {
            throw new Error(`O ID ${targetId} não foi reconhecido como Usuário nem como Escola.`);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            id: targetId,
            scope,
            entity_name: entityName,
            total_sum: Number(totalSum.toFixed(2)),
            count,
            details: scope === "user" ? details : "Soma consolidada de todos os usuários da escola"
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
