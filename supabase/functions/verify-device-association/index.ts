import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Parse Request
        const { qr_code } = await req.json();

        if (!qr_code) {
            throw new Error("Parâmetro ausente: qr_code é obrigatório.")
        }

        console.log(`[SECURITY-VERIFY] Validando QR: ${qr_code}`);

        // 3. Consultar Associação em 'dispositivos_carteira'
        let { data: association, error } = await supabase
            .from('dispositivos_carteira')
            .select(`
                id,
                status,
                carteira_id,
                carteira:carteira_id (
                    id,
                    Usuario,
                    carteira_code,
                    usuario_info:Usuario (
                        nome,
                        email,
                        tipo_acesso,
                        status
                    )
                )
            `)
            .eq('qr_code', qr_code)
            .maybeSingle();

        if (error) {
            console.error("Database error:", error);
            throw new Error("Erro interno ao recuperar dispositivo.");
        }

        let finalAuthData = null;

        // Se encontrou no dispositivo extra
        if (association && association.carteira?.usuario_info) {
             console.log(`[SECURITY-VERIFY] QR localizado em dispositivo extra. Carteira: ${association.carteira_id}`);
             
             // Validação de Status do Dispositivo
             if (association.status !== 'ativo') {
                  return new Response(JSON.stringify({
                      success: false,
                      message: "Este dispositivo foi bloqueado ou inativado.",
                      code: "DISPOSITIVO_INATIVO",
                      dispositivo_associado: "não"
                  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
             }

             finalAuthData = {
                 carteira_id: association.carteira_id,
                 usuario: association.carteira.usuario_info,
                 usuario_id: association.carteira.Usuario
             };
        } else {
             // 4. Fallback: Tentar QR nativo da Carteira
             console.log(`[SECURITY-VERIFY] QR não está em dispositivos extras. Buscando na Carteira...`);
             const { data: carteiraDirect, error: errCart } = await supabase
                .from('carteira')
                .select(`
                    id,
                    Usuario,
                    usuario_info:Usuario (
                        nome,
                        email,
                        tipo_acesso,
                        status
                    )
                `)
                .eq('carteira_code', qr_code)
                .maybeSingle();

             if (carteiraDirect && carteiraDirect.usuario_info) {
                 console.log(`[SECURITY-VERIFY] QR localizado como carteira nativa: ${carteiraDirect.id}`);
                 finalAuthData = {
                     carteira_id: carteiraDirect.id,
                     usuario: carteiraDirect.usuario_info,
                     usuario_id: carteiraDirect.Usuario
                 };
             }
        }

        // 5. Se após as duas buscas não encontrou nada
        if (!finalAuthData) {
             console.warn(`[UNAUTHORIZED] Tentativa frustrada com QR não localizado: ${qr_code}`);
             return new Response(JSON.stringify({
                success: false,
                message: "Ação negada: Este QR Code não está associado a nenhuma conta ativa.",
                details: "O vínculo da conta não foi localizado no sistema.",
                code: "QR_NAO_ASSOCIADO",
                dispositivo_associado: "não"
             }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // 6. Verificar status da conta do usuário
        if (finalAuthData.usuario?.status === 'Inativo') {
             return new Response(JSON.stringify({
                success: false,
                message: "A conta associada a este código está suspensa.",
                code: "USUARIO_INATIVO",
                dispositivo_associado: "não"
             }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // 7. Sucesso - Acesso Legítimo
        console.log(`[SUCCESS] Acesso validado para: ${finalAuthData.usuario?.nome}`);
        
        return new Response(JSON.stringify({
            success: true,
            message: "Autenticação realizada com sucesso.",
            dispositivo_associado: "sim",
            data: {
                carteira_id: finalAuthData.carteira_id,
                usuario: {
                    id: finalAuthData.usuario_id,
                    nome: finalAuthData.usuario?.nome,
                    tipo: finalAuthData.usuario?.tipo_acesso
                }
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

    } catch (error: any) {
        console.error("[CRITICAL VERIFY-DEVICE]:", error.message);
        return new Response(JSON.stringify({
            success: false,
            message: "Falha na verificação de segurança.",
            error: error.message
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
})
