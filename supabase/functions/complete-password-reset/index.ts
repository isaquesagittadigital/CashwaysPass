import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // 1. Tratamento de CORS (Essencial para o Bubble)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 2. Captura o Token do Header Authorization
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error("Token de autorização não encontrado no cabeçalho.");
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabaseAdminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        // 3. Valida o Token e identifica o usuário dono dele
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            throw new Error(`Token inválido ou expirado: ${userError?.message}`);
        }

        // 4. Captura a nova senha do corpo da requisição (JSON do Bubble)
        const body = await req.json();
        const { new_password } = body;

        if (!new_password) {
            throw new Error("A nova senha não foi enviada no corpo da requisição.");
        }

        // 5. Executa o reset administrativo da senha usando o ID do usuário validado
        const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: new_password }
        );

        if (authError) {
            throw new Error(`Erro ao atualizar senha no Auth: ${authError.message}`);
        }

        // 6. Sincroniza a nova senha na sua tabela public.usuarios
        await supabaseAdmin
            .from('usuarios')
            .update({ senha: new_password })
            .eq('UserID', user.id);

        return new Response(JSON.stringify({
            success: true,
            message: "Senha redefinida com sucesso!"
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("Erro no Reset Final:", error.message);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
})
