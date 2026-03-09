import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Chave da API da Brevo (antiga Sendinblue)
// Configure no Supabase: supabase secrets set BREVO_API_KEY=xkeysib-...
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');

// Email do remetente (DEVE ser validado na Brevo)
// Se não configurar, tenta usar um genérico, mas pode falhar.
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'no-reply@seudominio.com';
const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'Sua Plataforma';

Deno.serve(async (req) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { email, temp_password, nome } = body;

        // Validação básica
        if (!email || !temp_password) {
            throw new Error("Email e Senha Temporária são obrigatórios.");
        }

        // --- MODO SIMULAÇÃO (Sem chave configurada) ---
        if (!BREVO_API_KEY) {
            console.log(`[SIMULAÇÃO BREVO] Enviando email para ${email}`);
            console.log(`[CONTEÚDO] Olá ${nome || 'Usuário'}, sua senha temporária é: ${temp_password}`);
            console.log(`[NOTA] Para envio real, configure 'BREVO_API_KEY' e 'SENDER_EMAIL' no Supabase.`);
            
            return new Response(JSON.stringify({ 
                success: true, 
                message: "Ambiente de Teste: Email simulado no Log (configure BREVO_API_KEY para envio real).",
                simulated_data: { email, temp_password } 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // --- ENVIO REAL VIA BREVO API ---
        
        const brevoPayload = {
            sender: {
                name: SENDER_NAME,
                email: SENDER_EMAIL
            },
            to: [
                {
                    email: email,
                    name: nome || "Novo Usuário"
                }
            ],
            subject: "Seu Acesso Temporário",
            htmlContent: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="color: #4CAF50; margin: 0;">Bem-vindo!</h1>
                    </div>
                    <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                        <p>Olá, <strong>${nome || 'Usuário'}</strong>!</p>
                        <p>Sua conta foi criada com sucesso. Abaixo estão suas credenciais de acesso temporário:</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                            <p style="margin: 5px 0;"><strong>Senha Temporária:</strong> <span style="font-size: 1.1em; color: #000; background: #eee; padding: 2px 5px; border-radius: 3px;">${temp_password}</span></p>
                        </div>
                        
                        <p style="color: #666; font-size: 0.9em;">Por questões de segurança, recomendamos que altere sua senha após o primeiro login.</p>
                        <br/>
                        <p>Atenciosamente,<br/><strong>Equipe ${SENDER_NAME}</strong></p>
                    </div>
                </div>
            `
        };

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify(brevoPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Erro Brevo API:", data);
            throw new Error(`Erro ao enviar email (Brevo/Sendinblue): ${data.message || JSON.stringify(data)}`);
        }

        console.log(`[BREVO] Email enviado com sucesso! Message ID: ${data.messageId}`);

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Email enviado com sucesso via Brevo.",
            message_id: data.messageId
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Function:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})