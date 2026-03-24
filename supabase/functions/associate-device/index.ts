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

    const { aluno_id, qr_code, nome_dispositivo } = await req.json()

    if (!aluno_id || !qr_code) {
      throw new Error("Parâmetros ausentes: aluno_id e qr_code são obrigatórios.")
    }

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str));

    let finalUsuarioId: number;

    // 1. Resolver o ID do Usuário (BigInt)
    if (isUUID(aluno_id)) {
      // Se for UUID, pode ser o ID da tabela 'aluno' ou o 'UserID' (auth) na tabela 'usuarios'
      const { data: alunoData } = await supabaseClient
        .from('aluno')
        .select('usuario_id')
        .eq('id', aluno_id)
        .single();
      
      if (alunoData?.usuario_id) {
        finalUsuarioId = Number(alunoData.usuario_id);
      } else {
        const { data: userData } = await supabaseClient
          .from('usuarios')
          .select('id')
          .eq('UserID', aluno_id)
          .single();
        
        if (userData?.id) {
          finalUsuarioId = Number(userData.id);
        } else {
          throw new Error("Aluno não encontrado com o UUID fornecido.");
        }
      }
    } else {
      finalUsuarioId = Number(aluno_id);
    }

    // 2. Localizar a Carteira do Usuário (pega a mais recente se houver mais de uma)
    const { data: carteira, error: carteiraError } = await supabaseClient
      .from('carteira')
      .select('id')
      .eq('Usuario', finalUsuarioId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (carteiraError || !carteira) {
      console.error("Erro busca carteira:", carteiraError);
      throw new Error(`Carteira não encontrada para o usuário ${finalUsuarioId}.`);
    }

    // 3. Associar o Dispositivo
    const { data: novoDispositivo, error: insertError } = await supabaseClient
      .from('dispositivos_carteira')
      .insert({
        carteira_id: carteira.id,
        qr_code: qr_code,
        nome_dispositivo: nome_dispositivo || "QR Code",
        status: 'ativo'
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        throw new Error("Este QR Code já está associado a uma carteira.");
      }
      throw new Error("Erro ao associar dispositivo: " + insertError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Dispositivo associado com sucesso!",
      data: novoDispositivo
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
