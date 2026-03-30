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
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let targetId: string | null = null;
        let period: string = '7 dias';

        const body = await req.json().catch(() => ({}));
        targetId = body.user_id || body.id || body.escola_id;
        period = body.period || '7 dias';

        if (!targetId) {
            const authHeader = req.headers.get('Authorization');
            if (authHeader) {
                const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
                if (user) targetId = user.id;
            }
        }

        if (!targetId) throw new Error("ID não informado.");

        // Calcular data de início baseado no período
        const startDate = new Date();
        switch (period) {
            case '12 meses': startDate.setFullYear(startDate.getFullYear() - 1); break;
            case '30 dias': startDate.setDate(startDate.getDate() - 30); break;
            case '7 dias': startDate.setDate(startDate.getDate() - 7); break;
            case '24 horas': startDate.setHours(startDate.getHours() - 24); break;
            default: startDate.setDate(startDate.getDate() - 7);
        }

        // 1. Identificar Entidade e Alunos vinculados
        const [{ data: userRec }, { data: schoolRec }] = await Promise.all([
            supabaseAdmin.from('usuarios').select('nome_completo, UserID').eq('UserID', targetId).maybeSingle(),
            supabaseAdmin.from('escola').select('nome_fantasia, id').eq('id', targetId).maybeSingle()
        ]);

        let scope = "unknown";
        let entityName = "Não encontrado";
        let userIds: string[] = [];
        let alunoIds: string[] = [];
        let escolaIdentifier: string | null = null;

        if (userRec) {
            if (userRec.tipo_acesso === 'Admin') {
                scope = "super_admin";
                entityName = "Consolidado Cashways";
                const { data: allStudents } = await supabaseAdmin.from('aluno').select('id, user_id');
                alunoIds = (allStudents || []).map(s => s.id).filter(Boolean);
                userIds = (allStudents || []).map(s => s.user_id).filter(Boolean);
            } else {
                scope = "user";
                entityName = userRec.nome_completo;
                const { data: aluno } = await supabaseAdmin.from('aluno').select('id, user_id, escola_id').eq('user_id', targetId).maybeSingle();
                if (aluno) {
                   alunoIds = [aluno.id];
                   userIds = [aluno.user_id].filter(Boolean);
                   escolaIdentifier = aluno.escola_id;
                }
            }
        } else if (schoolRec) {
            scope = "school";
            entityName = schoolRec.nome_fantasia;
            escolaIdentifier = schoolRec.id;
            const { data: students } = await supabaseAdmin.from('aluno').select('id, user_id').eq('escola_id', targetId);
            alunoIds = (students || []).map(s => s.id).filter(Boolean);
            userIds = (students || []).map(s => s.user_id).filter(Boolean);
        }

        if (alunoIds.length === 0 && userIds.length === 0) {
            return new Response(JSON.stringify({ 
                success: true, 
                metrics: { total_invested: 0, total_spent: 0, purpose_balance: 0, free_balance: 0 },
                chart_data: []
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const [movementsRes, usersRes, purposesRes, turmasRes] = await Promise.all([
            supabaseAdmin.from('movimentacao_financeira')
              .select('*')
              .or(`aluno_id.in.(${alunoIds.join(',')}),request_payload->>userId.in.(${userIds.join(',')})`)
              .gte('created_date', startDate.toISOString()),
            supabaseAdmin.from('usuarios').select('UserID, saldo_carteira, saldo_investido').in('UserID', userIds),
            supabaseAdmin.from('propositos').select('usuario_id, saldo').in('usuario_id', userIds),
            (scope === 'school' || scope === 'super_admin') ? 
                (scope === 'school' ? supabaseAdmin.from('turma').select('id, nome').eq('escola_id', targetId) : supabaseAdmin.from('turma').select('id, nome'))
                : Promise.resolve({ data: [] })
        ]);

        const movements = movementsRes.data || [];
        const users = usersRes.data || [];
        const purposes = purposesRes.data || [];
        const turmasList = turmasRes.data || [];

        const depositTypes = ['RECARGA_PIX', 'RECARGA_CARTEIRA', 'ADICAO_MANUAL'];
        const expenseTypes = ['COMPRA_LOJA', 'COMPRA_PRODUTO_MERCADO', 'COMPRA_PRODUTO_INDIVIDUAL', 'COMPRA_PRODUTO_ENTRETENIMENTO', 'CONSUMO_MERCADO', 'ESTORNO_VENDA'];
        const successStatuses = ['CONCLUIDO', 'SUCESSO', 'PAGO'];

        let totalInvested = 0;
        let totalSpent = 0;

        movements.forEach(m => {
            if (!successStatuses.includes(m.status || '')) return;
            const val = parseFloat(String(m.valor || '0'));
            if (depositTypes.includes(m.tipo_operacao)) totalInvested += val;
            else if (expenseTypes.includes(m.tipo_operacao)) totalSpent += val;
        });

        const currentFreeBalance = users.reduce((acc, curr) => acc + parseFloat(String(curr.saldo_carteira || '0')), 0);
        const currentPurposeBalance = purposes.reduce((acc, curr) => acc + parseFloat(String(curr.saldo || '0')), 0);

        // 4. Processar Métricas por Turma (se escopo escola)
        let turmasMetrics: any[] = [];
        if (scope === 'school') {
            const { data: studentsWithTurma } = await supabaseAdmin.from('aluno').select('id, user_id, turma_id').eq('escola_id', targetId);
            
            turmasMetrics = turmasList.map(t => {
                const turmaStudents = (studentsWithTurma || []).filter(s => s.turma_id === t.id);
                const tAlunoIds = turmaStudents.map(s => s.id);
                const tUserIds = turmaStudents.map(s => s.user_id).filter(Boolean);

                let tInvested = 0;
                let tSpent = 0;
                movements.forEach(m => {
                   if (tAlunoIds.includes(m.aluno_id) && successStatuses.includes(m.status || '')) {
                       const val = parseFloat(String(m.valor || '0'));
                       if (depositTypes.includes(m.tipo_operacao)) tInvested += val;
                       else if (expenseTypes.includes(m.tipo_operacao)) tSpent += val;
                   }
                });

                const tFree = users.filter(u => tUserIds.includes(u.UserID)).reduce((acc, curr) => acc + parseFloat(String(curr.saldo_carteira || '0')), 0);
                const tPurpose = purposes.filter(p => tUserIds.includes(p.usuario_id)).reduce((acc, curr) => acc + parseFloat(String(curr.saldo || '0')), 0);

                return {
                    id: t.id,
                    name: t.nome,
                    students: tAlunoIds.length,
                    invested: Number(tInvested.toFixed(2)),
                    spent: Number(tSpent.toFixed(2)),
                    balance: Number((tFree + tPurpose).toFixed(2))
                };
            });
        }

        // 5. Processar Dados do Gráfico de Transasções
        const chartMap = new Map<string, any>();
        
        // Inicializar o mapa com as datas do período para garantir que dias vazios apareçam
        const tempDate = new Date(startDate);
        const dayOptions: Intl.DateTimeFormatOptions = period === '12 meses' ? { month: 'short' } : { day: '2-digit', month: 'short' };
        
        while (tempDate <= new Date()) {
            const label = tempDate.toLocaleDateString('pt-BR', dayOptions);
            chartMap.set(label, { label, pix: 0, manual: 0, transfer: 0, market: 0, total: 0 });
            if (period === '12 meses') tempDate.setMonth(tempDate.getMonth() + 1);
            else tempDate.setDate(tempDate.getDate() + 1);
        }

        movements.forEach(m => {
            if (!successStatuses.includes(m.status || '')) return;
            
            const date = new Date(m.created_date);
            const label = date.toLocaleDateString('pt-BR', dayOptions);
            const entry = chartMap.get(label) || { label, pix: 0, manual: 0, transfer: 0, market: 0, total: 0 };
            
            const val = parseFloat(String(m.valor || '0'));
            
            if (m.tipo_operacao === 'RECARGA_PIX') entry.pix += val;
            else if (m.tipo_operacao === 'ADICAO_MANUAL') entry.manual += val;
            else if (m.tipo_operacao === 'TRANSFERENCIA_INTERNA') entry.transfer += val;
            else if (expenseTypes.includes(m.tipo_operacao)) entry.market += val;
            
            entry.total = entry.pix + entry.manual + entry.transfer + entry.market;
            chartMap.set(label, entry);
        });

        const chartData = Array.from(chartMap.values());

        return new Response(JSON.stringify({ 
            success: true, 
            metrics: {
                total_invested: Number(totalInvested.toFixed(2)),
                total_spent: Number(totalSpent.toFixed(2)),
                purpose_balance: Number(currentPurposeBalance.toFixed(2)),
                free_balance: Number(currentFreeBalance.toFixed(2))
            },
            turmas: turmasMetrics,
            chart_data: chartData
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
