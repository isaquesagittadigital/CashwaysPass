import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações lendo de Environment Variables
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || "no-reply@cashways.app"; 
const SENDER_NAME = Deno.env.get('SENDER_NAME') || "Cashways Pass";
const BUBBLE_URL = "https://cashways-pass.bubbleapps.io";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { email, temp_password: access_password, nome } = body;

        if (!email || !access_password) {
            throw new Error("Email e Senha de Acesso são obrigatórios.");
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Garantir que o usuário exista no Supabase Auth
        console.log(`[AUTH] Tentando criar ou atualizar usuário: ${email}`);
        
        let finalUserId: string;

        // Tenta criar primeiro
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: access_password,
            email_confirm: true,
            user_metadata: { nome: nome || 'Usuário' }
        });

        if (createError) {
            // Se o erro for de usuário já existente, tentamos atualizar
            if (createError.message.includes('already registered') || createError.status === 422) {
                console.log(`[AUTH] Usuário já existe. Buscando ID por e-mail no DB para atualizar.`);
                
                // Buscamos o ID na nossa tabela pública pra garantir o vínculo ou tentamos buscar no auth se tivermos permissão de busca por e-mail
                const { data: existingUser } = await supabaseAdmin
                    .from('usuarios')
                    .select('UserID')
                    .eq('email', email)
                    .single();
                
                if (existingUser?.UserID) {
                    finalUserId = existingUser.UserID;
                    console.log(`[AUTH] Atualizando senha do usuário: ${finalUserId}`);
                    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                        finalUserId,
                        { password: access_password }
                    );
                    if (updateError) console.warn(`[AUTH_WARN] Falha ao atualizar senha: ${updateError.message}`);
                } else {
                    // Se não tivermos o ID no banco, e o createUser falhou, 
                    // temos um impasse na listagem administrativa.
                    // Vamos tentar buscar o usuário pelo email de forma administrativa.
                    const { data: { user }, error: getError } = await supabaseAdmin.auth.admin.listUsers();
                    // Como listUsers() está falhando com "Database error finding users", 
                    // vamos tentar uma alternativa se disponível ou retornar erro amigável.
                    throw new Error("Erro administrativo ao verificar existência do usuário. Verifique as configurações do Auth.");
                }
            } else {
                throw createError;
            }
        } else {
            finalUserId = newUser.user.id;
        }

        // 2. Vincular o UserID na tabela public.usuarios
        console.log(`[DB] Vinculando UserID ${finalUserId} ao email ${email}`);
        const { error: dbError } = await supabaseAdmin
            .from('usuarios')
            .update({ 
                UserID: finalUserId,
                senha: access_password,
                primeiro_acesso: false // Marcar como ainda não ativado/pendente se necessário, ou false para indicar fluxo de acesso
            })
            .eq('email', email);

        if (dbError) {
            console.warn(`[DB_WARNING] Falha ao atualizar tabela Usuarios: ${dbError.message}`);
            // Não bloqueamos o e-mail se a tabela pública falhar (pode ser que o registro ainda não exista lá)
        }

        // 3. Enviar E-mail via Brevo
        console.log(`[ACCESS_EMAIL] Enviando para: ${email}. Destino: ${BUBBLE_URL}`);
        
        const brevoPayload = {
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: email, name: nome || "Novo Usuário" }],
            subject: "🔐 Seu Acesso - Cashways Pass",
            htmlContent: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #003d7a 0%, #1a73e8 100%); padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Bem-vindo ao Cashways Pass!</h1>
                    </div>
                    <div style="padding: 30px; background-color: #ffffff;">
                        <p style="font-size: 16px; line-height: 1.6;">Olá, <strong>${nome || 'Usuário'}</strong>!</p>
                        <p style="font-size: 16px; line-height: 1.6;">Sua conta foi criada com sucesso. Utilize os dados abaixo para acessar a plataforma:</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #1a73e8; margin: 25px 0;">
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Link de acesso:</p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: bold; color: #1a73e8;">${BUBBLE_URL}</p>
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">E-mail:</p>
                            <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold; color: #333;">${email}</p>
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Senha de acesso:</p>
                            <p style="margin: 0; font-size: 20px; font-weight: bold; color: #1a73e8; letter-spacing: 1px;">${access_password}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 35px 0; text-decoration: none;">
                            <a href="${BUBBLE_URL}" style="background-color: #1a73e8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Ir para o Sistema</a>
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

        const data = await response.json();

        return new Response(JSON.stringify({ 
            success: true, 
            message_id: data.messageId,
            auth_user_id: finalUserId
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("[FATAL_ERROR]", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

