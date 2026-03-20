import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- CONFIGURAÃ‡ÃƒO MANUAL (HARDCODED) ---
const TRANSFEERA_CLIENT_ID = "4522e10a-9af1-40fe-a61b-61c63e4a2741";
const TRANSFEERA_CLIENT_SECRET = "a3498e75-0ff9-4a29-920e-b5c71bd78585ba464774-b962-4244-990e-ce426379f27d";
const TRANSFEERA_AUTH_URL = "https://login-api.transfeera.com/authorization";
// URL base da API de Pix (Ajustar se for ambiente de sandbox para dev.transfeera.com)
const TRANSFEERA_API_URL = "https://api.transfeera.com";

Deno.serve(async (req) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json()
        const { id_pix } = body;

        if (!id_pix) {
            throw new Error("ParÃ¢metro 'id_pix' Ã© obrigatÃ³rio.")
        }

        console.log(`[POLLING] Verificando status do Pix ID: ${id_pix}`)

        // 2. Autenticar na Transfeera
        const authToken = await getTransfeeraToken();

        // 3. Consultar Status na Transfeera
        // Endpoint: GET /pix/qrcode/{id} (Descoberto pelo usuÃ¡rio)
        const responseCtx = await fetch(`${TRANSFEERA_API_URL}/pix/qrcode/${id_pix}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'User-Agent': 'Supabase Polling'
            }
        });

        if (!responseCtx.ok) {
            const errTxt = await responseCtx.text()
            console.error(`Erro ao consultar Transfeera: ${responseCtx.status}`, errTxt)
            if (responseCtx.status === 404) {
                return new Response(JSON.stringify({ status: 'NOT_FOUND', message: 'QRCode Pix nÃ£o encontrado na Transfeera' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })
            }
            throw new Error(`Erro API Transfeera: ${responseCtx.status}`)
        }

        const pixData = await responseCtx.json()

        // No JSON enviado pelo usuÃ¡rio, o status vem na raiz como "CONCLUIDA"
        const status = (pixData.status || '').toUpperCase();
        console.log(`[POLLING] Status retornado pela Transfeera: ${status}`);

        // Adicionei CONCLUIDA na lista de sucessos
        const successStatuses = ['CONCLUIDA', 'PAID', 'SETTLED', 'COMPLETED', 'CONFIRMED', 'FINALIZADO'];

        if (successStatuses.includes(status)) {
            // 4. Se estiver pago, atualiza o Banco
            console.log(`Status de SUCESSO detectado (${status}). Iniciando processamento...`);
            
            // 4.1 IdempotÃªncia e ExistÃªncia: Verificar se o registro existe e seu status
            const { data: currentInv, error: fetchError } = await supabaseClient
                .from('investimento_aluno')
                .select('id, status_investimento, id_user, valor')
                .eq('id_pix_transfeera', id_pix)
                .maybeSingle()

            if (fetchError) {
                console.error("Erro ao buscar investimento:", fetchError);
                throw new Error("Erro interno ao consultar o banco de dados.");
            }

            if (!currentInv) {
                console.log(`[POLLING] Investimento nÃ£o encontrado para id_pix: ${id_pix}`);
                return new Response(JSON.stringify({ 
                    success: false, 
                    status: 'NOT_FOUND_IN_DB',
                    message: 'Este Pix nÃ£o estÃ¡ registrado no sistema Cashways.' 
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })
            }

            if (currentInv.status_investimento === 'PAGO') {
                 console.log("Pagamento jÃ¡ processado anteriormente.");
                 return new Response(JSON.stringify({ 
                    success: true, 
                    status: 'PAGO', 
                    message: 'Pagamento jÃ¡ foi processado anteriormente.',
                    data: pixData 
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })
            }

            // 4.2 Atualizar Status do Investimento para PAGO
            const { data: investimentoUpdated, error: investError } = await supabaseClient
                .from('investimento_aluno')
                .update({ status_investimento: 'PAGO' })
                .eq('id_pix_transfeera', id_pix) 
                .select()
                .maybeSingle()

            if (investError || !investimentoUpdated) {
                console.error("Erro ao atualizar Supabase (Investimento):", investError);
                throw new Error("Erro ao atualizar status do investimento ou registro desapareceu.");
            }
            
             // 4.3 Atualizar Saldo do UsuÃ¡rio e Logs
            const userId = investimentoUpdated.id_user;
            const valorPago = Number(investimentoUpdated.valor);

            try {
                // Busca dados do usuÃ¡rio (Saldo autal e Nome)
                const { data: usuarioData, error: userError } = await supabaseClient
                    .from('usuarios')
                    .select('UserID, saldo_carteira, nome, nome_completo')
                    .eq('UserID', userId)
                    .single()

                if (userError || !usuarioData) {
                    throw new Error(`UsuÃ¡rio nÃ£o encontrado para atualizar saldo: ${userError?.message}`);
                }

                const saldoAtual = Number(usuarioData.saldo_carteira) || 0;
                const novoSaldo = saldoAtual + valorPago;
                const nomeAluno = usuarioData.nome_completo || usuarioData.nome || "Aluno";

                // Atualiza a carteira
                const { error: updateBalanceError } = await supabaseClient
                    .from('usuarios')
                    .update({ saldo_carteira: novoSaldo })
                    .eq('UserID', userId)

                if (updateBalanceError) {
                    throw new Error(`Erro no update de saldo: ${updateBalanceError.message}`);
                }

                console.log(`Saldo atualizado para usuÃ¡rio ${userId}. Novo saldo: ${novoSaldo}`);

                // 4.4 Logs Solicitados
                
                const { data: alunoInfoLog } = await supabaseClient.from('aluno').select('id, nome').eq('user_id', userId).maybeSingle();
                const realAlunoId = alunoInfoLog?.id || null;
                const nomeAlunoLog = alunoInfoLog?.nome || nomeAluno;

                // Log 1: QRCode Pago
                await supabaseClient.from('movimentacao_financeira').insert({
                    aluno_id: realAlunoId,
                    tipo_operacao: 'PAGAMENTO_PIX_CONFIRMADO',
                    status: 'CONCLUIDO',
                    request_payload: { id_pix, userId, status_transfeera: status },
                    response_payload: { 
                        mensagem: 'O QRCode foi pago com sucesso na Transfeera.',
                        item: "ConfirmaÃ§Ã£o de PIX",
                        valor_total: valorPago,
                        aluno_nome: nomeAlunoLog
                    },
                    http_status: 200
                })

                // Log 2: Valor Inserido
                await supabaseClient.from('movimentacao_financeira').insert({
                    aluno_id: realAlunoId,
                    tipo_operacao: 'CREDITO_CONTA',
                    status: 'CONCLUIDO',
                    request_payload: { userId, valor_pago: valorPago, saldo_anterior: saldoAtual, saldo_novo: novoSaldo },
                    response_payload: { 
                        mensagem: `CrÃ©dito PIX aprovado e adicionado Ã  conta.`,
                        item: "Recarga PIX",
                        valor_total: valorPago,
                        aluno_nome: nomeAlunoLog
                    },
                    http_status: 200
                })

            } catch (processError: any) {
                console.error("Erro no processamento pÃ³s-confirmaÃ§Ã£o (Saldo/Logs):", processError);
                // NÃ£o lanÃ§amos erro fatal aqui para nÃ£o reverter o status 'PAGO' do investimento, caso contrÃ¡rio o loop do front continuaria tentando pagar
            }

            return new Response(JSON.stringify({ 
                success: true, 
                status: 'PAGO', 
                message: 'Pagamento confirmado e banco atualizado.',
                data: pixData 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // Se ainda nÃ£o pagou
        return new Response(JSON.stringify({
            success: true,
            status: status || 'PENDING',
            message: 'Ainda nÃ£o identificado como pago.',
            data: pixData
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

// FunÃ§Ã£o auxiliar para AutenticaÃ§Ã£o
async function getTransfeeraToken() {
    console.log("Autenticando na Transfeera...")
    const response = await fetch(TRANSFEERA_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: TRANSFEERA_CLIENT_ID,
            client_secret: TRANSFEERA_CLIENT_SECRET
        })
    })

    if (!response.ok) {
        throw new Error(`Auth Falhou: ${response.status}`)
    }

    const data = await response.json()
    return data.access_token
}
