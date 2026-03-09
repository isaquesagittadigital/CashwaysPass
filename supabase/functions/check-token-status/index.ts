import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )

        const { token } = await req.json()

        if (!token) throw new Error("Token não fornecido.")

        const { data: { user }, error } = await supabaseClient.auth.getUser(token)

        if (error || !user) {
            return new Response(JSON.stringify({
                expired: true,
                message: "Token inválido ou expirado.",
                error: error?.message
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        return new Response(JSON.stringify({
            expired: false,
            user_id: user.id,
            email: user.email,
            message: "Sessão ativa."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ expired: true, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }
})
