import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json();
        const { dispositivo_id } = body;

        if (!dispositivo_id) {
            throw new Error("Parâmetro 'dispositivo_id' é obrigatório.");
        }

        // 1. Buscar dispositivo e info da carteira/usuario
        const { data: dispositivo, error: fetchError } = await supabaseClient
            .from('dispositivos_carteira')
            .select(`
                id,
                status,
                nome_dispositivo,
                qr_code,
                carteira_id,
                carteira (
                    id,
                    Usuario,
                    usuarios (
                        nome,
                        email,
                        UserID,
                        avatar_url
                    )
                )
            `)
            .eq('id', dispositivo_id)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (!dispositivo) {
            throw new Error("Dispositivo não encontrado no sistema.");
        }

        // 2. Verificar se existe uma carteira vinculada
        const isAssociated = !!dispositivo.carteira_id;

        return new Response(JSON.stringify({
            success: true,
            has_wallet: isAssociated,
            message: isAssociated ? "Dispositivo já está associado a uma carteira." : "Dispositivo está disponível para associação.",
            data: {
                dispositivo: {
                    id: dispositivo.id,
                    nome: dispositivo.nome_dispositivo,
                    qr_code: dispositivo.qr_code,
                    status: dispositivo.status
                },
                associado_a: isAssociated ? {
                    carteira_id: dispositivo.carteira_id,
                    usuario_nome: dispositivo.carteira?.usuarios?.nome || "Não encontrado",
                    usuario_email: dispositivo.carteira?.usuarios?.email || "Não informado",
                    usuario_id: dispositivo.carteira?.usuarios?.UserID
                } : null
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
