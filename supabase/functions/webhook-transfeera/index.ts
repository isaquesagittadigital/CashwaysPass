import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Transfeera-Signature',
}

// --- CONFIGURAÃ‡ÃƒO MANUAL (HARDCODED) ---
// Como solicitado, todas as credenciais estÃ£o no cÃ³digo para nÃ£o depender de Secrets do painel.

// 1. Secret para validar a assinatura do Webhook (opcional se quiser pular validaÃ§Ã£o)
// Se deixar vazio "", o cÃ³digo pula a verificaÃ§Ã£o de seguranÃ§a (Ãºtil para testes rÃ¡pidos)
const TRANSFEERA_WEBHOOK_SECRET = ""; 

// 2. Credenciais de AutenticaÃ§Ã£o (Client Credentials)
const TRANSFEERA_CLIENT_ID = "4522e10a-9af1-40fe-a61b-61c63e4a2741";
const TRANSFEERA_CLIENT_SECRET = "a3498e75-0ff9-4a29-920e-b5c71bd78585ba464774-b962-4244-990e-ce426379f27d";
const TRANSFEERA_AUTH_URL = "https://login-api.transfeera.com/authorization";

// ---------------------------------------

// FunÃ§Ã£o auxiliar para converter Hex String para Unit8Array e verificar
const hexToUint8Array = (hex: string) => {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
}

const verifySignature = async (secret: string, payload: string, signature: string) => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );
    
    // A assinatura recebida Ã© hex, precisamos comparar
    // Mas a API verify espera a assinatura (signature) como ArrayBuffer
    // E o dado assinado (payload) como ArrayBuffer
    
    const signatureArray = hexToUint8Array(signature);
    const payloadArray = encoder.encode(payload);

    return await crypto.subtle.verify(
        "HMAC",
        key,
        signatureArray,
        payloadArray
    );
}


serve(async (req) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Security: Verify Signature
        const signatureHeader = req.headers.get('Transfeera-Signature')
        // Usa a constante do cÃ³digo em vez da variÃ¡vel de ambiente
        const webhookSecret = TRANSFEERA_WEBHOOK_SECRET

        // Se a secret estiver vazia (nÃ£o configurada no cÃ³digo), avisa e segue.
        if (!webhookSecret) {
            console.warn("AVISO: TRANSFEERA_WEBHOOK_SECRET nÃ£o configurada no cÃ³digo. Pulando verificaÃ§Ã£o de assinatura.")
        } else if (!signatureHeader) {
            return new Response(JSON.stringify({ error: "Missing Transfeera-Signature header" }), { status: 401 })
        } else {
            // Se tiver secret, faz a validaÃ§Ã£o...
            const parts = signatureHeader.split(',')
            const timestampPart = parts.find(p => p.trim().startsWith('t='))
            const signaturePart = parts.find(p => p.trim().startsWith('v1='))

            if (!timestampPart || !signaturePart) {
                return new Response(JSON.stringify({ error: "Invalid Signature Format" }), { status: 401 })
            }

            const ts = timestampPart.split('=')[1]
            const receivedSignature = signaturePart.split('=')[1]
            const rawBody = await req.text()
            const signedPayload = `${ts}.${rawBody}`
            
            // VerificaÃ§Ã£o nativa
            const isValid = await verifySignature(webhookSecret, signedPayload, receivedSignature);

            if (!isValid) {
                console.error(`Assinatura invÃ¡lida. Recebido: ${receivedSignature}`)
                return new Response(JSON.stringify({ error: "Invalid Signature" }), { status: 401 })
            }
            
            var payload = JSON.parse(rawBody)
        }

        if (typeof payload === 'undefined') {
            payload = await req.json()
        }

        console.log("Evento Recebido Transfeera:", JSON.stringify(payload))

        // 3. Process Event
        const eventData = payload.data || payload
        const eventType = payload.object || payload.type
        const integrationId = eventData.integration_id || eventData.data?.integration_id
        const status = eventData.status || eventData.data?.status
        // Tenta pegar o ID da transfeera se vier no payload para log
        const transfeeraId = eventData.id || eventData.data?.id

        console.log(`Processando evento: Tipo=${eventType}, Status=${status}, IntegrationID=${integrationId}`)

        if (integrationId && status) {
            const successStatuses = ['FINALIZADO', 'PAID', 'SETTLED', 'COMPLETED', 'CONFIRMED'];

            if (successStatuses.includes(status.toUpperCase())) {
                console.log(`Pagamento confirmado para Investimento ID: ${integrationId}`)

                // --- NOVO: Captura o Bearer Token e prepara para uso ---
                try {
                    const authToken = await getTransfeeraToken()
                    console.log("Autenticado na Transfeera com sucesso (Token obtido via cÃ³digo hardcoded).")

                    // AQUI: VocÃª pode usar o authToken para buscar mais detalhes na API da Transfeera
                    // Exemplo (comentado pois depende do endpoint exato):
                    // const apiResponse = await fetch(`https://api.transfeera.com/pix/${eventData.id}`, {
                    //    headers: { Authorization: `Bearer ${authToken}` }
                    // })
                    // const pixDetails = await apiResponse.json()
                    // console.log("Detalhes atualizados da Transfeera:", pixDetails)

                } catch (authError) {
                    console.error("Aviso: Falha ao autenticar na Transfeera para validaÃ§Ã£o extra:", authError)
                    // NÃ£o interrompemos o fluxo principal de atualizaÃ§Ã£o do banco pois o Webhook jÃ¡ foi validado pela assinatura
                }
                // -------------------------------------------------------

                const { data, error } = await supabaseClient
                    .from('investimento_aluno')
                    .update({ status_investimento: 'PAGO' })
                    .eq('id', integrationId)
                    .select()

                if (error) {
                    console.error("Erro ao atualizar investimento_aluno:", error)
                    throw error
                }

                if (data.length === 0) {
                    console.warn(`Investimento nÃ£o encontrado no banco com o ID ${integrationId}`)
                } else {
                    console.log("Status atualizado para PAGO no banco.")
                }
            }
        } else {
            console.log("Evento ignorado: NÃ£o contÃ©m integration_id ou status.")
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro interno:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})

// FunÃ§Ã£o auxiliar para AutenticaÃ§Ã£o na Transfeera com Credenciais Fixas
async function getTransfeeraToken() {
    const clientId = TRANSFEERA_CLIENT_ID
    const clientSecret = TRANSFEERA_CLIENT_SECRET
    
    // URL de Auth (usando env var se existir, senÃ£o default prod)
    const authUrl = TRANSFEERA_AUTH_URL

    console.log("Iniciando autenticaÃ§Ã£o OAuth2 Client Credentials...")

    const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'IntegraÃ§Ã£o Supabase' 
        },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error("Erro no endpoint de Auth da Transfeera:", errorText)
        throw new Error(`Falha na autenticaÃ§Ã£o: ${response.status}`)
    }

    const data = await response.json()
    // O retorno esperado Ã© { access_token: "...", token_type: "Bearer", ... }

    if (!data.access_token) {
        throw new Error("Token nÃ£o encontrado na resposta da Transfeera")
    }

    return data.access_token
}
