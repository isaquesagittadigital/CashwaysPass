import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error("Token de autorização não fornecido.")
        }

        // Initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Try to get ID from query string or request body
        let id: string | null = null

        const url = new URL(req.url)
        id = url.searchParams.get('id')

        if (!id && req.method !== 'GET') {
            try {
                const body = await req.json()
                id = body.id
            } catch (e) {
                // Ignore body parse errors if ID already found in URL
            }
        }

        if (!id) {
            return new Response(JSON.stringify({ error: 'ID da turma não fornecido' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        // Fetch turma data
        const { data, error } = await supabaseClient
            .from('turma')
            .select('*')
            .eq('id', id)
            .maybeSingle()

        if (error) {
            throw error
        }

        if (!data) {
            return new Response(JSON.stringify({ error: 'Turma não encontrada' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            })
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
