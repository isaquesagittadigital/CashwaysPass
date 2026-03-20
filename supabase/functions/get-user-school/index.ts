import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error("Token de autorizaÃ§Ã£o nÃ£o fornecido.")
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Tenta ler o corpo da requisiÃ§Ã£o para pegar params
        let reqBody: any = {}
        try {
            if (req.method !== 'GET') {
                reqBody = await req.json().catch(() => ({}))
            }
        } catch (e) { /* ignore */ }

        const url = new URL(req.url)
        const queryUserId = url.searchParams.get('user_id')
        const { user_id } = reqBody

        // 1. Determinar o ID do usuÃ¡rio alvo (prioridade para o filtro passado)
        let targetUserId = user_id || queryUserId

        if (!targetUserId) {
            // Se nÃ£o houver filtro, busca o usuÃ¡rio do token
            const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

            if (authError || !user) {
                return new Response(JSON.stringify({ error: 'UsuÃ¡rio nÃ£o autenticado e nenhum user_id fornecido como filtro.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401,
                })
            }
            targetUserId = user.id
        }

        // 2. Buscar o ID da escola associado ao usuÃ¡rio alvo
        let { data: usuarioData, error: usuarioError } = await supabaseClient
            .from('usuarios')
            .select('escola_id')
            .eq('UserID', targetUserId)
            .maybeSingle()

        let targetEscolaId = usuarioData?.escola_id

        // Se nÃ£o encontrar em usuarios, tenta na tabela 'aluno'
        if (!targetEscolaId) {
            const { data: alunoData } = await supabaseClient
                .from('aluno')
                .select('escola_id')
                .eq('user_id', targetUserId)
                .maybeSingle()
            
            targetEscolaId = alunoData?.escola_id
        }

        if (!targetEscolaId) {
            return new Response(JSON.stringify({ error: 'Escola nÃ£o encontrada para este usuÃ¡rio' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            })
        }

        // 3. Buscar os detalhes completos da escola
        const { data: escolaData, error: escolaError } = await supabaseClient
            .from('escola')
            .select('*')
            .eq('id', targetEscolaId)
            .single()

        if (escolaError || !escolaData) {
            throw new Error("Erro ao carregar detalhes da escola: " + (escolaError?.message || "NÃ£o encontrada"))
        }

        return new Response(JSON.stringify(escolaData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

