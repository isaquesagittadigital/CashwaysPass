import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // O trigger do banco envia o dado no body
        const body = await req.json()
        console.log("Payload recebido:", JSON.stringify(body))

        const { record } = body
        const usuarioId = record?.id // O ID do usuÃ¡rio (UUID vindo da tabela auth.users)

        if (!usuarioId) {
            throw new Error("usuario_id nÃ£o encontrado no payload")
        }

        console.log(`Criando propÃ³sitos para o usuÃ¡rio: ${usuarioId}`)

        const propositos = [
            { usuario_id: usuarioId, nome: 'AlimentaÃ§Ã£o', saldo: 0 },
            { usuario_id: usuarioId, nome: 'Mercado', saldo: 0 },
            { usuario_id: usuarioId, nome: 'Entretenimento', saldo: 0 },
            { usuario_id: usuarioId, nome: 'Minha Reserva', saldo: 0 }
        ]

        const { error } = await supabaseClient
            .from('propositos')
            .insert(propositos)

        if (error) {
            console.error("Erro ao inserir propÃ³sitos:", error)
            throw error
        }

        return new Response(JSON.stringify({ success: true, message: "PropÃ³sitos criados com sucesso" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro na Function create-user-propositos:", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

