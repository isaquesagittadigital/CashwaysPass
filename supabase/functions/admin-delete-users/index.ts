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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        // Cria Cliente com Service Role (Admin)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        const body = await req.json()
        const { user_ids } = body; // Espera array de UUIDs: ["uuid1", "uuid2"]

        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
            throw new Error("O campo 'user_ids' deve ser um array de UUIDs não vazio.")
        }

        console.log(`[ADMIN SOFT-DELETE] Iniciando inativação de ${user_ids.length} usuários...`);

        const results = [];

        for (const userId of user_ids) {
            try {
                // ESTÁGIO 1: Marcar como deletado na tabela pública (Soft Delete)
                const { error: dbError } = await supabaseAdmin
                    .from('usuarios')
                    .update({ deleted: true })
                    .eq('UserID', userId)

                if (dbError) throw new Error(`Erro ao atualizar tabela usuarios: ${dbError.message}`)

                // ESTÁGIO 2: Banir o usuário no Auth (Impede login)
                const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
                    userId,
                    { ban_duration: '876000h' } // ~100 anos de banimento
                )

                if (banError) {
                    console.warn(`Aviso: Falha ao banir usuário ${userId} no Auth (mas foi marcado como deleted no DB):`, banError);
                }

                results.push({ id: userId, status: 'SOFT_DELETED', message: 'Usuário marcado como deletado e banido.' });

            } catch (err: any) {
                console.error(`Falha ao processar ${userId}:`, err);
                results.push({ id: userId, status: 'ERROR', message: err.message });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            total_requested: user_ids.length,
            results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Function Admin Delete:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
