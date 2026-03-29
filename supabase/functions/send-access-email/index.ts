import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações lendo de Environment Variables
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || "cashways.br@outlook.com"; 
const SENDER_NAME = Deno.env.get('SENDER_NAME') || "Cashways Pass";

const VERCEL_URL = "https://cashways-pass-frontend.vercel.app";
const BUBBLE_URL = "https://cashways-pass.bubbleapps.io";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { email, temp_password, nome, tipo_acesso, escola_id } = body;
        const access_password = temp_password || Math.random().toString(36).slice(-10);

        if (!email) {
            throw new Error("Email é obrigatório.");
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Identificar ou Criar Usuário no Supabase Auth
        console.log(`[AUTH] Processando usuário: ${email}`);
        
        let finalUserId: string | null = null;

        // Tenta criar primeiro
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: access_password,
            email_confirm: true,
            user_metadata: { nome: nome || 'Usuário' }
        });

        if (createError) {
            // Se o usuário já existe no Auth
            if (createError.message.includes('already registered') || createError.status === 422) {
                console.log(`[AUTH] Usuário ${email} já existe. Recuperando ID para reset de senha.`);
                
                // Busca o usuário via listUsers (admin) para pegar o ID
                const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                if (listError) throw listError;
                
                const existingAuthUser = users.find(u => u.email === email);
                
                if (existingAuthUser) {
                    finalUserId = existingAuthUser.id;
                    console.log(`[AUTH] Resetando senha do usuário existente: ${finalUserId}`);
                    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                        finalUserId,
                        { password: access_password }
                    );
                    if (updateError) throw updateError;
                } else {
                    throw new Error("Usuário consta como registrado mas não foi encontrado na listagem administrativa.");
                }
            } else {
                throw createError;
            }
        } else {
            finalUserId = newUser.user.id;
        }

        if (!finalUserId) throw new Error("Falha ao resolver ID do usuário.");

        // 2. Upsert na tabela public.usuarios
        console.log(`[DB] Sincronizando tabela usuarios para ${email}`);
        
        const insertPayload: any = {
            email: email,
            nome_completo: nome || 'Usuário',
            nome: nome || 'Usuário',
            UserID: finalUserId,
            senha: access_password,
            temp_pass: access_password,
            primeiro_acesso: false,
            tipo_acesso: tipo_acesso || 'Lojista',
            status: 'active',
            excluido: 'no'
        };

        if (escola_id) insertPayload.escola_id = escola_id;
        if (body.cpf) insertPayload.cpf = body.cpf;
        if (body.telefone) insertPayload.telefone = body.telefone;
        if (body.turmaID) insertPayload.turmaID = body.turmaID;

        // Tenta encontrar por email primeiro para evitar erro de vinculo multiple
        const { data: existingDbUser } = await supabaseAdmin.from('usuarios').select('id').eq('email', email).maybeSingle();

        let dbError;
        if (existingDbUser) {
            const { error: updateError } = await supabaseAdmin.from('usuarios').update(insertPayload).eq('id', existingDbUser.id);
            dbError = updateError;
        } else {
            const { error: insertError } = await supabaseAdmin.from('usuarios').insert(insertPayload);
            dbError = insertError;
        }

        if (dbError) {
            console.error(`[DB_ERROR] Falha no upsert: ${dbError.message}`);
            // Nao retornamos erro fatal aqui se o Auth ja funcionou, mas registramos
        }

        // 3. Determinar Link de Redirecionamento Correto
        const isInternalType = tipo_acesso === 'Administrador' || tipo_acesso === 'Escola' || tipo_acesso === 'Admin';
        const redirect_url = isInternalType ? VERCEL_URL : BUBBLE_URL;

        // 4. Enviar E-mail via Brevo
        console.log(`[ACCESS_EMAIL] Enviando para: ${email}. Redirect: ${redirect_url}`);
        
        const brevoPayload = {
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: email, name: nome || "Usuário" }],
            subject: "🔐 Seus Dados de Acesso - Cashways Pass",
            htmlContent: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="background: linear-gradient(135deg, #001f3f 0%, #0044cc 100%); padding: 40px 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: 0.5px;">Cashways Pass</h1>
                        <p style="color: #e0e0e0; margin-top: 10px; font-size: 16px;">Sua plataforma de gestão escolar e pagamentos</p>
                    </div>
                    <div style="padding: 40px 30px; background-color: #ffffff;">
                        <p style="font-size: 18px; color: #1a202c;">Olá, <strong>${nome || 'Usuário'}</strong>!</p>
                        <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">
                            ${existingDbUser ? 'Sua conta foi atualizada com novos dados de acesso.' : 'Sua conta foi criada com sucesso!'} 
                            Abaixo estão suas credenciais exclusivas para acessar o sistema:
                        </p>
                        
                        <div style="background-color: #f7fafc; padding: 25px; border-radius: 12px; border: 1px solid #edf2f7; margin: 30px 0;">
                            <div style="margin-bottom: 20px;">
                                <p style="margin: 0; font-size: 13px; color: #718096; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">E-mail</p>
                                <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 601; color: #2d3748;">${email}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-size: 13px; color: #718096; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Senha Temporária</p>
                                <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: bold; color: #1a73e8; letter-spacing: 2px;">${access_password}</p>
                            </div>
                        </div>
                        
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${redirect_url}" style="background-color: #1a73e8; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; display: inline-block; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(26, 115, 232, 0.2);">Acessar Plataforma</a>
                        </div>
                        
                        <p style="margin: 0; font-size: 14px; color: #718096; line-height: 1.5; background-color: #fff9f0; padding: 15px; border-radius: 8px; border-left: 4px solid #ffb020;">
                            <strong>Atenção:</strong> Por segurança, recomendamos que você altere sua senha no primeiro acesso através do painel de configurações da sua conta.
                        </p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #edf2f7;">
                        <p style="margin: 0; font-size: 13px; color: #a0aec0;">
                            Dúvidas? Entre em contato com o suporte da sua escola ou responda a este e-mail.<br>
                            © 2024 Cashways Pass. Todos os direitos reservados.
                        </p>
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

        const resData = await response.json();

        return new Response(JSON.stringify({ 
            success: true, 
            message_id: resData.messageId,
            action: existingDbUser ? 'updated' : 'created',
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
