import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { validatePasswordStrength } from "../_shared/validation.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();
        const { user_id, current_password, new_password, confirm_password } = body;

        if (!user_id || !current_password || !new_password) {
            throw new Error("Parâmetros obrigatórios: user_id, current_password e new_password.");
        }

        const passCheck = validatePasswordStrength(new_password);
        if (!passCheck.valid) {
            throw new Error(passCheck.message);
        }

        if (new_password !== confirm_password && confirm_password !== undefined) {
            throw new Error("A nova senha e a confirmação não conferem.");
        }

        const { data: usuario, error: userError } = await supabaseAdmin
            .from('usuarios')
            .select('email')
            .eq('UserID', user_id)
            .single();

        if (userError || !usuario?.email) {
            throw new Error("Não foi possível localizar o usuário.");
        }

        // Valida senha atual via Login
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
            email: usuario.email,
            password: current_password,
        });

        if (signInError) {
            throw new Error("A senha atual fornecida está incorreta.");
        }

        // Altera para a nova
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            { password: new_password }
        );

        if (authError) {
            throw new Error(`Falha ao atualizar: ${authError.message}`);
        }

        // Sincroniza coluna senha (se você usar para algo)
        await supabaseAdmin
            .from('usuarios')
            .update({ senha: new_password })
            .eq('UserID', user_id);

        return new Response(JSON.stringify({
            success: true,
            message: "Senha alterada com sucesso!"
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
