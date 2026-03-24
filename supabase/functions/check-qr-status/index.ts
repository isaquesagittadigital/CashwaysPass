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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { qr_code } = await req.json()

    if (!qr_code) {
      throw new Error("Parâmetro 'qr_code' é obrigatório.")
    }

    // 1. Buscar o dispositivo e carregar dados do usuário (aluno) vinculado
    const { data: dispositivo, error: fetchError } = await supabaseClient
      .from('dispositivos_carteira')
      .select(`
        id,
        status,
        created_at,
        nome_dispositivo,
        carteira_id,
        carteira (
          Usuario,
          usuarios (
            nome,
            email,
            UserID
          )
        )
      `)
      .eq('qr_code', qr_code)
      .maybeSingle();

    if (fetchError) {
      throw new Error("Erro ao consultar banco de dados: " + fetchError.message);
    }

    if (!dispositivo) {
      return new Response(JSON.stringify({
        success: true,
        associated: false,
        message: "Este QR Code não está associado a nenhuma carteira."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. Formatar retorno se associado
    return new Response(JSON.stringify({
      success: true,
      associated: true,
      message: "QR Code já está associado.",
      data: {
        qr_code: qr_code,
        status: dispositivo.status,
        nome_dispositivo: dispositivo.nome_dispositivo,
        usuario_nome: dispositivo.carteira?.usuarios?.nome || "Não encontrado",
        usuario_email: dispositivo.carteira?.usuarios?.email || "Não informado",
        carteira_id: dispositivo.carteira_id,
        created_at: dispositivo.created_at
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
