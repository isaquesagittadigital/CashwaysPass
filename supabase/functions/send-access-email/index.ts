import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações via Environment Variables para maior flexibilidade e segurança
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || "no-reply@cashways.app"; 
const SENDER_NAME = Deno.env.get('SENDER_NAME') || "Cashways Pass";

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { email, temp_password, nome } = body;

        if (!email || !temp_password) {
            throw new Error("Email e Senha Temporária são obrigatórios.");
        }

        console.log(`[DEBUG] Iniciando envio para: ${email} via Brevo. Sender: ${SENDER_EMAIL}`);
        
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
            subject: "Seu Acesso Temporário - Cashways Pass",
            htmlContent: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #003d7a 0%, #1a73e8 100%); padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Bem-vindo ao Cashways Pass!</h1>
                    </div>
                    <div style="padding: 30px; background-color: #ffffff;">
                        <p style="font-size: 16px; line-height: 1.6;">Olá, <strong>${nome || 'Usuário'}</strong>!</p>
                        <p style="font-size: 16px; line-height: 1.6;">Sua conta foi criada com sucesso. Abaixo estão suas credenciais de acesso temporário para a plataforma:</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #1a73e8; margin: 25px 0;">
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">E-mail de acesso:</p>
                            <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold; color: #333;">${email}</p>
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Senha temporária:</p>
                            <p style="margin: 0; font-size: 20px; font-weight: bold; color: #1a73e8; letter-spacing: 1px;">${temp_password}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="https://pass.cashways.app/login" style="background-color: #1a73e8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Acessar Plataforma</a>
                        </div>
                        
                        <p style="color: #ed6c02; font-size: 14px; background-color: #fff4e5; padding: 12px; border-radius: 6px; text-align: center;">
                            <strong>Atenção:</strong> Por segurança, altere sua senha após o primeiro acesso.
                        </p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                        <p style="margin: 0; font-size: 12px; color: #999;">© 2024 Cashways Pass. Todos os direitos reservados.</p>
                    </div>
                </div>
            `
        };

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY || '',
                'content-type': 'application/json'
            },
            body: JSON.stringify(brevoPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("[BREVO_ERROR]", data);
            throw new Error(`Erro Brevo: ${data.message || JSON.stringify(data)}`);
        }

        console.log(`[OK] E-mail enviado. ID: ${data.messageId}`);

        return new Response(JSON.stringify({ 
            success: true, 
            message_id: data.messageId
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("[ERROR]", error.message);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
