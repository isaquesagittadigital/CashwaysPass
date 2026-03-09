
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        
        // 2. Initialize Supabase Client (Service Role - Admin Access)
        // Usamos a Service Role Key para ter acesso total ao banco e evitar erros de RLS/JWT expirado
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Try to Get User (Optional if escola_id is provided)
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader ?? undefined)
        
        // Tenta ler o corpo da requisição
        let body: any = {};
        try {
            body = await req.json();
        } catch (e) {
            // Body vazio ok
        }

        let escolaId = body.escola_id;

        // Se NÃO foi passado ID da escola, aí sim EXIGIMOS o usuário logado para descobrir a escola dele
        if (!escolaId) {
            if (userError || !user) {
                // Se não temos escola no body E não temos usuário, aí é erro.
                throw new Error("Você deve enviar o 'escola_id' OU estar autenticado.");
            }

            const { data: usuarioLogado, error: usuarioLogError } = await supabaseClient
                .from('usuarios')
                .select('escola_id')
                .eq('UserID', user.id)
                .single();

            if (usuarioLogError || !usuarioLogado) {
                throw new Error("Perfil de usuário não encontrado.");
            }
            escolaId = usuarioLogado.escola_id;
        }

        if (!escolaId) {
             throw new Error("ID da escola não identificado.");
        }

        // 4. Fetch Turmas (Classes) from this School
        const { data: turmas, error: turmasError } = await supabaseClient
            .from('turma')
            .select('id, nome')
            .eq('escola_id', escolaId);

        if (turmasError) throw new Error("Erro ao buscar turmas: " + turmasError.message);

        // 5. Fetch Students (Usuarios) from this School
        // Trazemos saldo_carteira e saldo_investido
        const { data: alunos, error: alunosError } = await supabaseClient
            .from('usuarios')
            .select('UserID, turmaID, saldo_carteira, saldo_investido')
            .eq('escola_id', escolaId)
            .eq('tipo_acesso', 'Aluno'); // Garante que é aluno

        if (alunosError) throw new Error("Erro ao buscar alunos: " + alunosError.message);

        // Map alunos IDs for Propositos query
        const alunosIds = alunos.map(a => a.UserID).filter(id => id !== null);

        // 6. Fetch Propositos for these students
        let propositos: any[] = [];
        if (alunosIds.length > 0) {
            const { data: propData, error: propError } = await supabaseClient
                .from('propositos')
                // Precisamos trazer o NOME para debuguar
                .select('usuario_id, saldo, nome')
                .in('usuario_id', alunosIds);
            
            if (propError) throw new Error("Erro ao buscar propósitos: " + propError.message);
            propositos = propData || [];
        }

        // 7. Data Aggregation
        // Processar saldos de propósitos por aluno
        const propositosPorAluno: Record<string, number> = {};
        propositos.forEach(p => {
            const uid = p.usuario_id;
            // O saldo no banco é texto, precisamos converter com cuidado
            let val = 0;
            if (p.saldo) {
                 // Remove tudo que não for número, ponto, vírgula ou sinal de menos
                 let clean = String(p.saldo).replace(/[^0-9.,-]/g, "");

                 // Lógica para detectar formato BR (1.000,00) vs US (1,000.00)
                 // Se tiver vírgula, assumimos que é decimal se for o último separador ou único
                 if (clean.includes(',')) {
                     // Remove pontos de milhar (ex: 1.200,50 -> 1200,50)
                     clean = clean.replace(/\./g, '');
                     // Troca vírgula por ponto (1200,50 -> 1200.50)
                     clean = clean.replace(',', '.');
                 }
                 
                 val = parseFloat(clean);
            }
            if (isNaN(val)) val = 0;

            // Debug Log para identificar problema na "Minha Reserva"
            console.log(`[DEBUG] User: ${uid} | Prop: "${p.nome}" | Raw: "${p.saldo}" | Converted: ${val}`);

            if (!propositosPorAluno[uid]) propositosPorAluno[uid] = 0;
            propositosPorAluno[uid] += val;
        });

        // Montar o resumo por turma
        const resumo = turmas.map(turma => {
            // Filtrar alunos desta turma
            const alunosDaTurma = alunos.filter(a => a.turmaID === turma.id);
            const qtdAlunos = alunosDaTurma.length;

            let totalInvestidoTurma = 0;

            alunosDaTurma.forEach(aluno => {
                // Soma saldo_carteira + saldo_investido (tabela usuarios)
                const carteira = Number(aluno.saldo_carteira) || 0;
                const investido = Number(aluno.saldo_investido) || 0;
                
                // Soma saldo em propósitos
                const totalPropositos = propositosPorAluno[aluno.UserID] || 0;

                // Total do aluno
                // Regra: "paga o saldo dele junto com os saldos que ele tem em proposito"
                // Assumindo que "saldo dele" = carteira + investido (se houver)
                totalInvestidoTurma += (carteira + investido + totalPropositos);
            });

            return {
                turma_id: turma.id,
                nome: turma.nome,
                qtd_alunos: qtdAlunos,
                total_investido: totalInvestidoTurma
            };
        });

        // 8. Return Response
        return new Response(JSON.stringify({ 
            success: true, 
            data: resumo 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
