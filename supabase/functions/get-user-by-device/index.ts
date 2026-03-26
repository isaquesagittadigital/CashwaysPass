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
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json();
        const { qr_code } = body;

        if (!qr_code) {
            throw new Error("Parâmetro 'qr_code' é obrigatório.");
        }

        console.log(`[USER-DETAIL] Buscando perfil por QR: ${qr_code}`);

        // 1. Tentar encontrar via dispositivos_carteira
        let { data: association, error: errAssoc } = await supabase
            .from('dispositivos_carteira')
            .select(`
                id,
                status,
                carteira_id,
                carteira:carteira_id (
                    id,
                    Usuario,
                    carteira_code,
                    usuarios:Usuario (
                        nome,
                        email,
                        UserID,
                        foto_perfil,
                        tipo_acesso,
                        status,
                        escola_id,
                        turmaID
                    )
                )
            `)
            .eq('qr_code', qr_code)
            .maybeSingle();

        if(errAssoc) console.error(`[USER-DETAIL] Erro na busca de dispositivo: ${errAssoc.message}`);

        let walletCode = null;
        let finalUser = null;
        let carteiraId = null;

        // Tentar extrair o usuário da estrutura retornada
        if (association && association.carteira?.usuarios) {
            console.log(`[USER-DETAIL] Encontrado dispositivo. Carteira: ${association?.carteira_id}`);
            finalUser = association.carteira.usuarios;
            carteiraId = association.carteira_id;
            walletCode = association.carteira.carteira_code;
        } else {
            // 2. Fallback: Tentar encontrar via carteira_code direto
            const { data: carteiraDirect, error: errCart } = await supabase
                .from('carteira')
                .select(`
                    id,
                    Usuario,
                    carteira_code,
                    usuarios:Usuario (
                        nome,
                        email,
                        UserID,
                        foto_perfil,
                        tipo_acesso,
                        status,
                        escola_id,
                        turmaID
                    )
                `)
                .eq('carteira_code', qr_code)
                .maybeSingle();

            if(errCart) console.error(`[USER-DETAIL] Erro na busca de carteira: ${errCart.message}`);

            if (carteiraDirect && carteiraDirect.usuarios) {
                console.log(`[USER-DETAIL] Encontrada carteira direta: ${carteiraDirect.id}`);
                finalUser = carteiraDirect.usuarios;
                carteiraId = carteiraDirect.id;
                walletCode = carteiraDirect.carteira_code;
            }
        }

        if (!finalUser) {
            return new Response(JSON.stringify({
                success: false,
                message: "Nenhum usuário associado a este QR Code foi encontrado.",
                code: "USER_NOT_FOUND"
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // 3. Buscar dados extras do aluno (opcional)
        const { data: alunoExtra } = await supabase
            .from('aluno')
            .select('id, saldo_investido, turma_id, escola_id')
            .eq('user_id', finalUser.UserID)
            .maybeSingle();

        return new Response(JSON.stringify({
            success: true,
            message: "Perfil do usuário recuperado com sucesso.",
            data: {
                id: finalUser.UserID,
                nome: finalUser.nome?.trim() || "",
                email: finalUser.email,
                avatar: finalUser.foto_perfil,
                tipo_acesso: finalUser.tipo_acesso,
                status_conta: finalUser.status,
                carteira_id: carteiraId,
                codigo_carteira: walletCode?.toString()?.trim() || "",
                detalhes_academicos: {
                    escola_id: alunoExtra?.escola_id || finalUser.escola_id,
                    turma_id: alunoExtra?.turma_id || finalUser.turmaID,
                    aluno_id_interno: alunoExtra?.id || null
                },
                financeiro_resumo: {
                    saldo_investido: alunoExtra?.saldo_investido || 0
                }
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
