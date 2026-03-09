import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
        )

        // Tenta ler o corpo da requisição para ver se foi passado um aluno_id explícito (para testes/admin)
        let reqBody = {}
        try {
            if (req.method !== 'GET') {
                reqBody = await req.json().catch(() => ({}))
            }
        } catch (e) {
            // ignore
        }

        // Tenta pegar de Query Param (GET) ou Body (POST)
        const url = new URL(req.url)
        const queryAlunoId = url.searchParams.get('aluno_id')
        // @ts-ignore
        const { aluno_id } = reqBody
        
        let targetAlunoId = aluno_id || queryAlunoId

        console.log(`Request Method: ${req.method}, Content-Type: ${req.headers.get('content-type') || 'N/A'}, Target Aluno ID: ${targetAlunoId}`)

        if (!targetAlunoId) {
            // 1. Obter o usuário logado a partir do token JWT caso não tenha sido passado aluno_id
            const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

            if (authError || !user) {
                return new Response(JSON.stringify({ error: 'Usuário não autenticado e aluno_id não fornecido' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401,
                })
            }

            // 2. Buscar o ID do aluno associado ao usuário
            const { data: aluno, error: alunoError } = await supabaseClient
                .from('aluno')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle()

            if (alunoError) {
                 console.error('Erro ao buscar aluno:', alunoError)
                 throw new Error('Erro ao buscar dados do aluno')
            }

            if (!aluno) {
                 return new Response(JSON.stringify({ error: 'Aluno não encontrado para este usuário' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                })
            }
            targetAlunoId = aluno.id
        }

        // 3. Buscar os investimentos do aluno
        const { data: investimentos, error: investError } = await supabaseClient
            .from('investimento_aluno')
            .select('*')
            .eq('aluno_id', targetAlunoId)

        if (investError) {
            console.error('Erro ao buscar investimentos:', investError)
            throw new Error('Erro ao buscar investimentos')
        }

        // Retorna envolvido em um objeto para facilitar parsing no Bubble
        return new Response(JSON.stringify({ investimentos: investimentos }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400, // Bad Request ou 500 dependendo do erro, mas 400 é seguro
        })
    }
})
