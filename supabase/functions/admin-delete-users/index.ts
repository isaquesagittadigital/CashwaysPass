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
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const body = await req.json()

        // Aceita: user_ids (array de auth UUIDs) OU db_ids (array de IDs da tabela usuarios)
        const { user_ids, db_ids } = body;

        if ((!user_ids || user_ids.length === 0) && (!db_ids || db_ids.length === 0)) {
            throw new Error("Informe 'user_ids' (UUIDs do Auth) ou 'db_ids' (IDs da tabela usuarios).")
        }

        const results: any[] = [];

        // Resolucao: se db_ids fornecidos, busca os UserIDs correspondentes
        let authUuids: string[] = user_ids || [];

        if (db_ids && db_ids.length > 0) {
            const { data: usuarios, error: fetchError } = await supabaseAdmin
                .from('usuarios')
                .select('id, UserID, email')
                .in('id', db_ids);

            if (fetchError) throw new Error(`Erro ao buscar usuarios: ${fetchError.message}`);

            for (const u of (usuarios || [])) {
                // HARD DELETE GLOBAL para o email do usuario
                const userEmail = u.email;

                // 1. Limpar por ID (FKs)
                await Promise.all([
                    supabaseAdmin.from('aluno').delete().eq('usuario_id', u.id),
                    supabaseAdmin.from('carteira').delete().eq('Usuario', u.id),
                    supabaseAdmin.from('turma').update({ professor_id: null }).eq('professor_id', u.id)
                ]);

                // 2. Limpar por Email em tabelas que possam ter vinculo isolado
                if (userEmail) {
                    await supabaseAdmin.from('aluno').delete().eq('email', userEmail);
                }

                // 3. Deletar da tabela usuarios
                const { error: dbDelError } = await supabaseAdmin
                    .from('usuarios')
                    .delete()
                    .eq('id', u.id);

                if (dbDelError) {
                    console.warn(`Erro ao deletar ${u.id} da tabela usuarios: ${dbDelError.message}`);
                }

                // 4. Coletar UUID do Auth
                if (u.UserID) {
                    authUuids.push(u.UserID);
                } else if (u.email) {
                    try {
                        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
                        const authUser = listData?.users?.find((au: any) => au.email === u.email);
                        if (authUser) authUuids.push(authUser.id);
                    } catch (e) {
                        console.warn(`Nao foi possivel buscar auth user por email ${u.email}:`, e);
                    }
                }

                results.push({ db_id: u.id, email: u.email, status: 'DELETED_FROM_DB' });
            }
        }

        // Deletar do Auth todos os UUIDs coletados e garantir limpeza por UUID na DB
        const uniqueAuthUuids = [...new Set(authUuids)];
        for (const authUuid of uniqueAuthUuids) {
            try {
                // Limpeza final por UUID em todas as tabelas possiveis (aluno, usuarios, etc)
                // Isso cobre casos onde o db_id nao foi passado mas o UUID do Auth foi
                const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(authUuid);
                const authEmail = authUser?.user?.email;

                await Promise.all([
                    supabaseAdmin.from('aluno').delete().eq('user_id', authUuid), 
                    supabaseAdmin.from('aluno').delete().eq('email', authEmail),
                    supabaseAdmin.from('usuarios').delete().eq('UserID', authUuid),
                    supabaseAdmin.from('usuarios').delete().eq('email', authEmail)
                ]);

                const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUuid);

                if (deleteAuthError) {
                    console.warn(`Aviso: Falha ao deletar ${authUuid} do Auth:`, deleteAuthError.message);
                    results.push({ auth_id: authUuid, status: 'AUTH_DELETE_FAILED', error: deleteAuthError.message });
                } else {
                    console.log(`[AUTH] Usuario ${authUuid} deletado do Auth com sucesso.`);
                    const existing = results.find(r => (r as any).auth_id === authUuid || (r as any).db_id);
                    if (existing) {
                        (existing as any).status = 'DELETED_FULLY';
                    } else {
                        results.push({ auth_id: authUuid, status: 'DELETED_FULLY' });
                    }
                }
            } catch (e: any) {
                console.error(`Erro ao deletar ${authUuid} do Auth:`, e);
                results.push({ auth_id: authUuid, status: 'ERROR', error: e.message });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            total_requested: (db_ids?.length || 0) + (user_ids?.length || 0),
            results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Erro Function Admin Delete:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
