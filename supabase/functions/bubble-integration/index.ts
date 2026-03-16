import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

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
        const supabaseAdminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        const supabase = createClient(supabaseUrl, supabaseAdminKey);

        const url = new URL(req.url);
        
        // Tenta pegar a ação de 3 lugares: URL, Body ou Header
        let action = url.searchParams.get('action');
        
        let body: any = null;
        if (req.method === 'POST' || req.method === 'PUT') {
          try {
            const clonedReq = req.clone();
            body = await clonedReq.json();
          } catch (e) {
            console.log("Não foi possível processar o corpo JSON");
          }
        }

        action = action || body?.action || req.headers.get('x-action');

        console.log(`Requisição recebida: ${req.method} ${url.pathname}`);
        console.log(`Action detectada: ${action}`);
        console.log(`Query Params: ${url.search}`);

        // --- AÇÃO: LISTAR ESCOLAS ATIVAS ---
        if (action === 'list-schools' || action === 'listar-escolas') {
            const { data, error } = await supabase
                .from('escola')
                .select('id, nome_fantasia, razao_social')
                .eq('status', 'active')
                .eq('deletado', false)
                .order('nome_fantasia', { ascending: true });

            if (error) throw error;
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // --- AÇÃO: LISTAR TURMAS ---
        if (action === 'list-turmas') {
            const escola_id = url.searchParams.get('escola_id');
            if (!escola_id) throw new Error("Parâmetro escola_id é obrigatório.");

            const { data, error } = await supabase
                .from('turma')
                .select('id, nome, Periodos')
                .eq('escola_id', escola_id)
                .order('nome', { ascending: true });

            if (error) throw error;
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // --- AÇÃO: LISTAR ALUNOS ---
        if (action === 'list-alunos') {
            const turma_id = url.searchParams.get('turma_id');
            if (!turma_id) throw new Error("Parâmetro turma_id é obrigatório.");

            const { data, error } = await supabase
                .from('usuarios')
                .select('id, nome_completo, email, cpf, primeiro_acesso')
                .eq('turmaID', turma_id)
                .eq('tipo_acesso', 'Aluno')
                .eq('primeiro_acesso', false) // Retorna apenas alunos que ainda não acessaram (yes = remove do retorno)
                .or('excluido.eq.no,excluido.is.null');

            if (error) throw error;
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // --- AÇÃO: ATIVAR CONTA (CREATE AUTH + SET PASSWORD) ---
        if (action === 'activate-account' || action === 'ativar-conta') {
            const student_id = body?.student_id;
            const password = body?.password;

            if (!student_id || !password) {
                throw new Error("Parâmetros student_id e password são obrigatórios.");
            }

            // 1. Fetch user data (public.usuarios)
            const { data: usuario, error: userError } = await supabase
                .from('usuarios')
                .select('id, email, nome_completo, escola_id, turmaID, cpf')
                .eq('id', student_id)
                .single();

            if (userError || !usuario) throw new Error("Usuário não encontrado.");
            
            // 2. Verificar se o usuário já existe no Supabase Auth para decidir entre Criar ou Atualizar
            let finalUserId: string | undefined;
            
            // Busca o ID do usuário diretamente via RPC (SQL) para evitar erros de banco de dados no Auth
            const { data: existingUserId, error: rpcError } = await supabase
                .rpc('get_user_id_by_email', { email_search: usuario.email });

            if (rpcError) {
                console.error("Erro ao buscar usuário via RPC:", rpcError);
                throw new Error("Erro interno ao validar usuário no sistema de autenticação.");
            }

            if (existingUserId) {
                // Se existe, atualiza a senha
                const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
                    existingUserId,
                    { password: password }
                );
                if (updateAuthError) throw updateAuthError;
                finalUserId = existingUserId;
                console.log(`Usuário existente atualizado via RPC: ${finalUserId}`);
            } else {
                // Se não existe, cria novo
                const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                    email: usuario.email,
                    password: password,
                    email_confirm: true,
                    user_metadata: { nome: usuario.nome_completo }
                });
                if (authError) throw authError;
                finalUserId = authUser.user.id;
                console.log(`Novo usuário criado: ${finalUserId}`);
            }

            // 3. Atualizar tabela usuarios vinculando o UserID e mudando status
            const { error: updateTableError } = await supabase
                .from('usuarios')
                .update({ 
                    UserID: finalUserId, 
                    status: 'active',
                    primeiro_acesso: true, // Coluna é boolean: true significa que já realizou o acesso
                    senha: password 
                })
                .eq('id', student_id);

            if (updateTableError) throw updateTableError;

            // 4. Sincronizar com a tabela 'aluno' (marcar primeiro_acesso como false)
            await supabase
                .from('aluno')
                .update({ primeiro_acesso: false })
                .eq('usuario_id', student_id);

            return new Response(JSON.stringify({ 
                success: true, 
                message: "Account activated successfully.",
                user_id: finalUserId
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        throw new Error("Ação inválida ou não especificada.");

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
})
