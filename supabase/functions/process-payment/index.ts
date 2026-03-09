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
        // 2. Initialize Supabase Client com SERVICE_ROLE_KEY
        // Isso permite inserir dados sem um usuário logado (bypass RLS)
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json()
        
        // Validação básica
        if (!body.aluno_id) {
            throw new Error("Campo 'aluno_id' é obrigatório.")
        }
        if (!body.valor) {
            throw new Error("Campo 'valor' é obrigatório.")
        }

        const targetUserId = body.aluno_id

        // 3. Validação: Verificar se o Usuário existe na tabela 'usuarios'
        // O usuário pediu para validar pelo campo UserID na tabela usuarios
        const { data: usuarioExistente, error: userCheckError } = await supabaseClient
            .from('usuarios')
            .select('UserID')
            .eq('UserID', targetUserId)
            .single()

        if (userCheckError || !usuarioExistente) {
             console.error("Erro validação usuário:", userCheckError)
             throw new Error(`Usuário não encontrado na tabela 'usuarios' com UserID: ${targetUserId}`)
        }

        // 4. Create Investment Record
        const { data: investimentoData, error: investError } = await supabaseClient
            .from('investimento_aluno')
            .insert({
                id_user: targetUserId,   // ID validado na tabela usuarios
                // aluno_id: targetUserId, // REMOVIDO: Evita erro de FK na tabela aluno se o ID não existir lá
                valor: body.valor,
                descricao: body.descricao,
                status_investimento: 'NAO_PAGO',
                data_inicio: new Date().toISOString().split('T')[0], // Garante YYYY-MM-DD para coluna DATE
                // Se o frontend enviar o ID da transfeera (ex: txid ou id da cobrança), salvamos aqui:
                id_pix_transfeera: body.id_pix_transfeera || body.txid
            })
            .select()
            .single(); // Return the created record

        if (investError) {
            console.error("Erro DETALHADO ao criar investimento_aluno:", JSON.stringify(investError));
            // Retorna o erro real do banco para o frontend saber o que houve (ex: FK violation)
            throw new Error(`Erro no Banco de Dados: ${investError.message} - ${investError.details || ''}`);
        }

        // --- NOVO LOG SOLICITADO ---
        console.log(`[QR_CODE_GEN] O aluno ${targetUserId} gerou um QR code com o status de NAO_PAGO.`);
        // ---------------------------

        // 5. Create Log in 'transfeera_log'
        const { error: logError } = await supabaseClient
            .from('transfeera_log')
            .insert({
                tipo_operacao: 'SOLICITACAO_SALDO',
                request_payload: { ...body, user_id: targetUserId },
                response_payload: { status: 'PENDING_MANUAL_CONFIRMATION', investimento_id: investimentoData.id, log_note: 'QR Code Generated - Aguardando Pagamento' },
                status: 'SOLICITACAO_NAO_PAGA',
                http_status: 200
            });

        if (logError) {
            console.error("Erro ao criar transfeera_log (Solicitação):", logError);
        }

        // --- NOVO LOG: REGISTRO DE GERAÇÃO DE QR CODE ---
        const { error: qrLogError } = await supabaseClient
            .from('transfeera_log')
            .insert({
                tipo_operacao: 'GERACAO_QR_CODE',
                request_payload: { ...body, user_id: targetUserId, context: 'QR Code display' },
                response_payload: {
                    message: `O aluno ${targetUserId} gerou um QR code com o status de NAO_PAGO.`,
                    investimento_id: investimentoData.id
                },
                status: 'NAO_PAGO',
                http_status: 200
            });

        if (qrLogError) {
            console.error("Erro ao criar transfeera_log (QR Code):", qrLogError);
        }

        // 6. Return Success Response
        return new Response(JSON.stringify({
            success: true,
            message: "Solicitação de saldo realizada com sucesso. Aguardando confirmação manual.",
            data: investimentoData
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})