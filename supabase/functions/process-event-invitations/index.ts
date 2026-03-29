import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || "cashways.br@outlook.com";
const SENDER_NAME = Deno.env.get('SENDER_NAME') || "Cashways Pass";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = "https://cashways-pass.bubbleapps.io";

function generatePassword(length = 10): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function sendAccessEmail(email: string, nome: string, password: string) {
    const brevoPayload = {
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email, name: nome }],
        subject: "🔐 Seu Acesso - Cashways Pass",
        htmlContent: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #003d7a 0%, #1a73e8 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Bem-vindo ao Cashways Pass!</h1>
                </div>
                <div style="padding: 30px; background-color: #ffffff;">
                    <p style="font-size: 16px; line-height: 1.6;">Olá, <strong>${nome}</strong>!</p>
                    <p style="font-size: 16px; line-height: 1.6;">Sua conta foi criada com sucesso. Utilize os dados abaixo para acessar a plataforma:</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #1a73e8; margin: 25px 0;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Link de acesso:</p>
                        <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: bold; color: #1a73e8;">${APP_URL}</p>
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">E-mail:</p>
                        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold; color: #333;">${email}</p>
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Senha de acesso:</p>
                        <p style="margin: 0; font-size: 22px; font-weight: bold; color: #1a73e8; letter-spacing: 2px;">${password}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${APP_URL}" style="background-color: #1a73e8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Acessar o Sistema</a>
                    </div>
                    
                    <p style="color: #1a73e8; font-size: 14px; background-color: #e8f0fe; padding: 12px; border-radius: 6px; text-align: center;">
                        Guarde sua senha em um local seguro. Você pode alterá-la no painel de perfil a qualquer momento.
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

    const result = await response.json();
    console.log(`[ACCESS_EMAIL] Enviado para ${email}:`, result);
    return result;
}

async function sendEventInviteEmail(
    email: string,
    nome: string,
    eventName: string,
    eventDate: string,
    schoolName: string
) {
    const formattedDate = new Date(eventDate + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    const brevoPayload = {
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email, name: nome }],
        subject: `Convite para Evento: ${eventName} na escola ${schoolName}`,
        htmlContent: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #003d7a 0%, #1a73e8 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Novo Convite Cashways Pass!</h1>
                </div>
                <div style="padding: 30px; background-color: #ffffff;">
                    <p style="font-size: 16px; line-height: 1.6;">Olá!</p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        Você acaba de ser convidado para o evento <strong>${eventName}</strong> na escola
                        <strong>${schoolName}</strong> no dia ${formattedDate}.
                    </p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        Ao acessar o sistema com o seu login atual, você já será automaticamente
                        redirecionado para o ambiente desta nova escola e evento.
                    </p>
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${APP_URL}" style="background-color: #1a73e8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Acessar o Sistema</a>
                    </div>
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

    const result = await response.json();
    console.log(`[INVITE_EMAIL] Enviado para ${email}:`, result);
    return result;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { eventId, escolaId, lojistasEmails, lojistasData = [] } = body;

        if (!eventId || !escolaId || !lojistasEmails?.length) {
            throw new Error('eventId, escolaId e lojistasEmails são obrigatórios.');
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Buscar dados do evento e escola
        const [{ data: evento }, { data: escola }] = await Promise.all([
            supabaseAdmin.from('eventos').select('nome, data_evento').eq('id', eventId).single(),
            supabaseAdmin.from('escola').select('nome_fantasia').eq('id', escolaId).single()
        ]);

        const eventName = evento?.nome || 'Evento';
        const eventDate = evento?.data_evento || new Date().toISOString().split('T')[0];
        const schoolName = escola?.nome_fantasia || 'Escola';

        const results: any[] = [];

        // 2. Processar cada lojista
        for (const email of lojistasEmails) {
            const lojistaData = lojistasData.find((l: any) => l.email === email);
            const nomeLojista = lojistaData?.nome || lojistaData?.name || 'Lojista';
            const proposito = lojistaData?.proposito || '';

            try {
                // Verificar se o lojista já existe em usuarios
                const { data: existingUser } = await supabaseAdmin
                    .from('usuarios')
                    .select('id, UserID, nome_completo, nome, status')
                    .eq('email', email)
                    .maybeSingle();

                let isNewUser = false;
                let accessPassword = '';

                if (!existingUser) {
                    // ─── NOVO LOJISTA: criar conta + enviar email com senha ───
                    isNewUser = true;
                    accessPassword = generatePassword(10);

                    // Criar no Supabase Auth
                    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                        email,
                        password: accessPassword,
                        email_confirm: true,
                        user_metadata: { nome: nomeLojista }
                    });

                    if (authError && !authError.message.includes('already registered')) {
                        throw authError;
                    }

                    const authUserId = authUser?.user?.id;

                    // Criar na tabela usuarios
                    const { error: insertError } = await supabaseAdmin.from('usuarios').insert({
                        email,
                        nome_completo: nomeLojista,
                        nome: nomeLojista,
                        UserID: authUserId || null,
                        senha: accessPassword,
                        temp_pass: accessPassword,
                        tipo_acesso: 'Lojista',
                        Proposito_Lojista: proposito,
                        escola_id: escolaId,
                        status: 'active',
                        excluido: 'no',
                        primeiro_acesso: false
                    });

                    if (insertError) {
                        console.warn(`[DB_WARN] Falha ao inserir lojista ${email}:`, insertError.message);
                    }

                    // Enviar email com senha de acesso
                    await sendAccessEmail(email, nomeLojista, accessPassword);
                    console.log(`[NEW_USER] Lojista criado e email de acesso enviado: ${email}`);

                } else {
                    // ─── LOJISTA EXISTENTE: apenas enviar convite do evento ───
                    console.log(`[EXISTING_USER] Lojista já existe: ${email}`);
                }

                // Enviar email de convite do evento (para todos)
                await sendEventInviteEmail(email, nomeLojista, eventName, eventDate, schoolName);

                results.push({
                    email,
                    isNewUser,
                    success: true
                });

            } catch (perLojistaError: any) {
                console.error(`[ERROR] Falha ao processar lojista ${email}:`, perLojistaError.message);
                results.push({ email, success: false, error: perLojistaError.message });
            }
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('[FATAL_ERROR]', error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
