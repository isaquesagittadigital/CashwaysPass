import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL');
const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'Sua Plataforma';
const BUBBLE_RESET_URL = Deno.env.get('BUBBLE_RESET_URL') || 'https://cashways-pass.bubbleapps.io/version-test/reset_pw';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { email } = await req.json();
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Gerar o link de recuperação
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: { redirectTo: BUBBLE_RESET_URL }
        });

        if (linkError) throw new Error(linkError.message);

        // 2. Buscar nome do usuário
        const { data: usuario } = await supabaseAdmin.from('usuarios').select('nome_completo').eq('email', email).single();
        const nome = usuario?.nome_completo || "Usuário";

        // 3. Enviar e-mail com Template Premium
        await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': BREVO_API_KEY || '', 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                to: [{ email, name: nome }],
                subject: "🔐 Recuperação de Senha",
                htmlContent: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 40px; text-align: center; color: white;">
                            <h1>Redefinir Senha</h1>
                        </div>
                        <div style="padding: 40px; text-align: center;">
                            <p>Olá <strong>${nome}</strong>, clique no botão abaixo para escolher uma nova senha:</p>
                            <a href="${linkData.properties.action_link}" style="background: #6366f1; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; margin: 20px 0;">Definir Nova Senha</a>
                        </div>
                    </div>`
            })
        });

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
})
