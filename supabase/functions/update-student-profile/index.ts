import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { sanitizeEmail, isValidEmail } from "../_shared/validation.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// FunÃ§Ã£o auxiliar para converter DD/MM/YYYY para YYYY-MM-DD
function formatToDBDate(dateStr: string) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) return dateStr; // JÃ¡ estÃ¡ no formato YYYY-MM-DD

    const parts = dateStr.split('/');
    if (parts.length === 3) {
        // Assume DD/MM/YYYY
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
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

        // --- MAGIC BODY PARSER ---
        const rawBody = await req.text();
        let body;

        try {
            body = JSON.parse(rawBody);
        } catch (e: any) {
            const fixedBody = rawBody.replace(/:\s*(\d+),(\d+)/g, ': $1.$2');
            try {
                body = JSON.parse(fixedBody);
            } catch (e2: any) {
                throw new Error(`JSON invÃ¡lido: ${e.message}`);
            }
        }

        const { user_id, email, nome_completo, data_nascimento } = body;

        if (!user_id) {
            throw new Error("user_id Ã© obrigatÃ³rio.");
        }

        const updateData: any = {};
        if (nome_completo !== undefined) updateData.nome_completo = nome_completo;
        if (email !== undefined) {
            const cleanEmail = sanitizeEmail(email);
            if (!isValidEmail(cleanEmail)) {
                throw new Error("Email fornecido Ã© invÃ¡lido.");
            }
            updateData.email = cleanEmail;
            body.email = cleanEmail; // update body.email for the auth variable below
        }
        if (data_nascimento !== undefined) {
            updateData.data_nascimento = formatToDBDate(data_nascimento);
        }

        // 1. Atualiza na tabela public.usuarios
        const { error: dbError } = await supabaseClient
            .from('usuarios')
            .update(updateData)
            .eq('UserID', user_id);

        if (dbError) throw dbError;

        // 2. Atualiza no Auth (Service Role permite isso)
        if (email) {
            await supabaseClient.auth.admin.updateUserById(user_id, { email });
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Perfil atualizado com sucesso!"
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

