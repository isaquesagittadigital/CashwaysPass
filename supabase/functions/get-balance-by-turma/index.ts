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
      throw new Error("Token de autorização não fornecido.")
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Tenta ler o corpo da requisição para pegar admin params
    let reqBody = {}
    try {
      if (req.method !== 'GET') {
        reqBody = await req.json().catch(() => ({}))
      }
    } catch (e) { /* ignore */ }

    const url = new URL(req.url)
    const queryEscolaId = url.searchParams.get('escola_id')
    const { escola_id } = reqBody as any

    let targetEscolaId = escola_id || queryEscolaId

    // Se a escola_id não foi enviada, busca a escola do usuário logado
    if (!targetEscolaId) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Usuário não autenticado e escola_id não fornecido' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }

      const { data: usuarioData, error: usuarioError } = await supabaseClient
        .from('usuarios')
        .select('escola_id')
        .eq('UserID', user.id)
        .maybeSingle()

      if (usuarioError || !usuarioData || !usuarioData.escola_id) {
        return new Response(JSON.stringify({ error: 'Escola não encontrada para este usuário' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }
      targetEscolaId = usuarioData.escola_id
    }

    // Busca turmas e soma os saldos dos alunos
    const { data: turmasData, error: turmasError } = await supabaseClient
      .from('turma')
      .select(`
        id,
        nome,
        aluno (
          saldo_carteira,
          saldo_investido
        )
      `)
      .eq('escola_id', targetEscolaId)

    if (turmasError) {
      throw turmasError
    }

    // Processar os dados para o formato final
    const distribution = turmasData.map((turma: any) => {
      const saldoLivre = turma.aluno?.reduce((acc: number, curr: any) => acc + Number(curr.saldo_carteira || 0), 0) || 0
      const saldoPropositos = turma.aluno?.reduce((acc: number, curr: any) => acc + Number(curr.saldo_investido || 0), 0) || 0
      
      return {
        turma_id: turma.id,
        turma_nome: turma.nome,
        saldo_livre: saldoLivre,
        saldo_propositos: saldoPropositos,
        total: saldoLivre + saldoPropositos
      }
    })

    distribution.sort((a, b) => a.turma_nome.localeCompare(b.turma_nome))

    return new Response(JSON.stringify({ 
      escola_id: targetEscolaId,
      data: distribution 
    }), {
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
