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

        console.log(`[WALLET_BALANCE] Analisando ID: ${targetId}`);

        // 1. Identificar Entidade (Usuário ou Escola)
        const [{ data: userRecord }, { data: schoolRecord }] = await Promise.all([
            supabaseAdmin.from('usuarios').select('nome_completo, UserID, saldo_carteira').eq('UserID', targetId).maybeSingle(),
            supabaseAdmin.from('escola').select('nome_fantasia, id').eq('id', targetId).maybeSingle()
        ]);

        let walletBalance = 0;
        let scope = "unknown";
        let entityName = "Não encontrado";

        if (userRecord) {
            scope = "user";
            entityName = userRecord.nome_completo;
            walletBalance = parseFloat(String(userRecord.saldo_carteira || '0'));

        } else if (schoolRecord) {
            scope = "school";
            entityName = schoolRecord.nome_fantasia;
            
            const { data: schoolData, error: schoolError } = await supabaseAdmin
                .from('usuarios')
                .select('saldo_carteira')
                .eq('escola_id', targetId);

            if (schoolError) throw schoolError;

            schoolData?.forEach(u => {
                walletBalance += parseFloat(String(u.saldo_carteira || '0'));
            });

        } else {
            throw new Error(`O ID ${targetId} não foi reconhecido como Usuário nem como Escola.`);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            id: targetId,
            scope,
            entity_name: entityName,
            wallet_balance: Number(walletBalance.toFixed(2))
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
