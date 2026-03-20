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
      throw new Error("Token de autorizaÃ§Ã£o nÃ£o fornecido. Envie o header 'Authorization: Bearer SEU_TOKEN'")
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Tenta ler o corpo da requisiÃ§Ã£o para pegar admin params
    let reqBody = {}
    try {
      if (req.method !== 'GET') {
        reqBody = await req.json().catch(() => ({}))
      }
    } catch (e) {
      // ignore
    }

    const url = new URL(req.url)
    const queryEscolaId = url.searchParams.get('escola_id')
    const { escola_id } = reqBody

    let targetEscolaId = escola_id || queryEscolaId

    // Se a escola_id nÃ£o foi enviada explicitamente, busca a escola do usuÃ¡rio logado
    if (!targetEscolaId) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'UsuÃ¡rio nÃ£o autenticado e escola_id nÃ£o fornecido' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }

      // Buscar o ID da escola associado ao usuÃ¡rio na tabela de usuarios ou aluno (dependendo do perfil)
      const { data: usuarioData, error: usuarioError } = await supabaseClient
        .from('usuarios')
        .select('escola_id')
        .eq('UserID', user.id)
        .maybeSingle()

      if (usuarioError || !usuarioData || !usuarioData.escola_id) {
        return new Response(JSON.stringify({ error: 'Escola nÃ£o encontrada para este usuÃ¡rio' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }
      targetEscolaId = usuarioData.escola_id
    }

    // 1. Buscar Saldo na Carteira e Saldo Investido somados dos alunos da escola
    const { data: alunosData, error: alunosDataError } = await supabaseClient
      .from('aluno')
      .select('saldo_carteira, saldo_investido')
      .eq('escola_id', targetEscolaId)

    if (alunosDataError) {
      throw new Error('Erro ao buscar dados dos alunos desta escola')
    }

    const saldoCarteira = alunosData.reduce((acc, curr) => acc + Number(curr.saldo_carteira || 0), 0)
    const saldoInvestido = alunosData.reduce((acc, curr) => acc + Number(curr.saldo_investido || 0), 0)

    // 2. Buscar Investimentos Pendentes (Aportes em processamento) da escola inteira
    const { data: investimentos, error: investError } = await supabaseClient
      .from('investimento_aluno')
      .select('valor_investido')
      .eq('escola_id', targetEscolaId)
      .eq('status_investimento', 'NAO_PAGO')

    if (investError) {
      throw new Error('Erro ao buscar investimentos pendentes')
    }

    // Somar aportes pendentes
    const precessamento = investimentos.reduce((acc, curr) => acc + Number(curr.valor_investido || 0), 0)

    // Formatar para o grÃ¡fico: 3 sÃ©ries
    const responseData = {
      labels: ["Saldo DisponÃ­vel", "Total Investido", "Em Processamento"],
      series: [saldoCarteira, saldoInvestido, precessamento],
      chartData: [
        { label: "Saldo DisponÃ­vel", value: saldoCarteira, color: "#4ECDC4" },   // Teal/Verde
        { label: "Total Investido", value: saldoInvestido, color: "#FF6B6B" },    // Vermelho/Rosa
        { label: "Em Processamento", value: precessamento, color: "#FECCA2" }     // Amarelo/Laranja
      ]
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Erro Function balance-distribution:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
