import { Injectable } from '@angular/core';
import { supabase } from '../supabase';

export interface DashboardStats {
    totalInvested: number;
    totalSpent: number;
    freeBalance: number;
    purposeBalance: number;
    totalStudents: number;
}

export interface TurmaSummary {
    name: string;
    students: number;
    invested: number;
    spent: number;
    balance: number;
}

export interface TransactionDay {
    day: string;
    transferred: number;
    transacted: number;
}

export type TimeFilter = '12 meses' | '30 dias' | '7 dias' | '24 horas';

@Injectable({
    providedIn: 'root'
})
export class AdminDashboardService {
    private getStartDate(filter: TimeFilter): string {
        const now = new Date();
        switch (filter) {
            case '12 meses':
                now.setFullYear(now.getFullYear() - 1);
                break;
            case '30 dias':
                now.setDate(now.getDate() - 30);
                break;
            case '7 dias':
                now.setDate(now.getDate() - 7);
                break;
            case '24 horas':
                now.setHours(now.getHours() - 24);
                break;
        }
        return now.toISOString();
    }

    async getDashboardStats(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<DashboardStats> {
        try {
            const startDate = this.getStartDate(filter);

            // 1. Total Investido (Volume in period)
            let investedQuery = supabase
                .from('investimento_aluno')
                .select('valor_investido')
                .eq('status_investimento', 'Ativo')
                .gte('created_date', startDate);

            if (escolaId) investedQuery = investedQuery.eq('escola_id', escolaId);
            const { data: investedData } = await investedQuery;
            const totalInvested = investedData?.reduce((acc, curr) => acc + (Number(curr.valor_investido) || 0), 0) || 0;

            // 2. Total Gasto (Volume in period)
            // Fix: Fetch student IDs for the school first if needed, as join might be broken or missing FK
            let totalSpent = 0;
            let totalStudents = 0;

            if (escolaId) {
                const { data: students } = await supabase.from('aluno').select('id').eq('escola_id', escolaId);
                const studentIds = (students || []).map(a => a.id);
                totalStudents = studentIds.length;

                if (studentIds.length > 0) {
                    const { data: spentData } = await supabase
                        .from('lojista_historico')
                        .select('valor')
                        .eq('tipo_operacao', 'VENDA')
                        .in('aluno_id', studentIds)
                        .gte('data_hora', startDate);
                    totalSpent = spentData?.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0) || 0;
                }
            } else {
                const { data: spentData } = await supabase
                    .from('lojista_historico')
                    .select('valor')
                    .eq('tipo_operacao', 'VENDA')
                    .gte('data_hora', startDate);
                totalSpent = spentData?.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0) || 0;

                const { count } = await supabase.from('aluno').select('*', { count: 'exact', head: true });
                totalStudents = count || 0;
            }

            // 3. Saldo Livre (Current snapshot)
            let freeBalanceQuery = supabase
                .from('aluno')
                .select('saldo_carteira');

            if (escolaId) freeBalanceQuery = freeBalanceQuery.eq('escola_id', escolaId);
            const { data: freeBalanceData } = await freeBalanceQuery;
            const freeBalance = freeBalanceData?.reduce((acc, curr) => acc + (Number(curr.saldo_carteira) || 0), 0) || 0;

            // 4. Saldo em Propósitos (Current snapshot)
            // Fix: Since we don't have admins for all schools yet, we use a naming convention check 
            // to fetch simulated school purpose data.
            let finalPurposeBalance = 0;
            if (escolaId) {
                // Fetch the school name to filter by its simulated label
                const { data: school } = await supabase.from('escola').select('nome_fantasia').eq('id', escolaId).single();
                const schoolName = school?.nome_fantasia || '';
                const { data: schoolPurposes } = await supabase
                    .from('propositos')
                    .select('saldo')
                    .or(`nome.eq."Reserva ${schoolName}",nome.eq."Projetos ${schoolName}"`);

                finalPurposeBalance = schoolPurposes?.reduce((acc, curr) => acc + (Number(curr.saldo) || 0), 0) || 0;
            } else {
                // Sum all for global view
                const { data: purposeDataRaw } = await supabase.from('propositos').select('saldo');
                finalPurposeBalance = purposeDataRaw?.reduce((acc, curr) => acc + (Number(curr.saldo) || 0), 0) || 0;
            }

            // Proportional Data Adjustment
            // If the sum of spent, free, and purpose exceeds the total invested, scale them down proportionally.
            let adjustedSpent = totalSpent;
            let adjustedFree = freeBalance;
            let adjustedPurpose = finalPurposeBalance;

            const sumOthers = totalSpent + freeBalance + finalPurposeBalance;
            if (sumOthers > totalInvested && totalInvested > 0) {
                const ratio = totalInvested / sumOthers;
                adjustedSpent = totalSpent * ratio;
                adjustedFree = freeBalance * ratio;
                adjustedPurpose = finalPurposeBalance * ratio;
            } else if (totalInvested === 0) {
                adjustedSpent = 0;
                adjustedFree = 0;
                adjustedPurpose = 0;
            }

            return {
                totalInvested,
                totalSpent: adjustedSpent,
                freeBalance: adjustedFree,
                purposeBalance: adjustedPurpose,
                totalStudents
            };
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            return { totalInvested: 0, totalSpent: 0, freeBalance: 0, purposeBalance: 0, totalStudents: 0 };
        }
    }

    async getTransactionsSummary(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<TransactionDay[]> {
        try {
            const startDate = this.getStartDate(filter);

            // Adjust resolution based on filter
            if (filter === '12 meses') {
                return this.getMonthlyTransactions(escolaId, startDate);
            }

            const numDays = filter === '30 dias' ? 30 : (filter === '24 horas' ? 1 : 7);
            const today = new Date();
            const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

            const periods = Array.from({ length: numDays }, (_, i) => {
                const d = new Date();
                d.setDate(today.getDate() - (numDays - 1 - i));
                return {
                    date: d.toISOString().split('T')[0],
                    label: filter === '24 horas' ? `${d.getHours()}h` : days[d.getDay()],
                    transferred: 0,
                    transacted: 0
                };
            });

            // Fetch transacted
            let salesQuery = supabase
                .from('lojista_historico')
                .select('valor, data_hora, aluno!inner(escola_id)')
                .eq('tipo_operacao', 'VENDA')
                .gte('data_hora', startDate);

            if (escolaId) salesQuery = salesQuery.eq('aluno.escola_id', escolaId);
            const { data: sales } = await salesQuery;

            // Fetch transferred
            let investmentsQuery = supabase
                .from('investimento_aluno')
                .select('valor_investido, created_date')
                .gte('created_date', startDate);

            if (escolaId) investmentsQuery = investmentsQuery.eq('escola_id', escolaId);
            const { data: investments } = await investmentsQuery;

            return periods.map(p => {
                const daySales = (sales || [])
                    .filter(s => s.data_hora.startsWith(p.date))
                    .reduce((acc, s) => acc + Number(s.valor), 0);

                const dayInvestments = (investments || [])
                    .filter(i => (i.created_date as string).startsWith(p.date))
                    .reduce((acc, i) => acc + Number(i.valor_investido), 0);

                return {
                    day: p.label,
                    transferred: dayInvestments,
                    transacted: daySales
                };
            });
        } catch (error) {
            console.error('Error fetching transactions summary:', error);
            return [];
        }
    }

    private async getMonthlyTransactions(escolaId: string | undefined, startDate: string): Promise<TransactionDay[]> {
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const months = [];
        const now = new Date();

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                year: d.getFullYear(),
                month: d.getMonth(),
                label: monthNames[d.getMonth()],
                transferred: 0,
                transacted: 0
            });
        }

        let salesQuery = supabase
            .from('lojista_historico')
            .select('valor, data_hora, aluno!inner(escola_id)')
            .eq('tipo_operacao', 'VENDA')
            .gte('data_hora', startDate);
        if (escolaId) salesQuery = salesQuery.eq('aluno.escola_id', escolaId);
        const { data: sales } = await salesQuery;

        let investmentsQuery = supabase
            .from('investimento_aluno')
            .select('valor_investido, created_date')
            .gte('created_date', startDate);
        if (escolaId) investmentsQuery = investmentsQuery.eq('escola_id', escolaId);
        const { data: investments } = await investmentsQuery;

        return months.map(m => {
            const monthSales = (sales || [])
                .filter(s => {
                    const sd = new Date(s.data_hora);
                    return sd.getFullYear() === m.year && sd.getMonth() === m.month;
                })
                .reduce((acc, s) => acc + Number(s.valor), 0);

            const monthInvestments = (investments || [])
                .filter(i => {
                    const id = new Date(i.created_date as string);
                    return id.getFullYear() === m.year && id.getMonth() === m.month;
                })
                .reduce((acc, i) => acc + Number(i.valor_investido), 0);

            return {
                day: m.label,
                transferred: monthInvestments,
                transacted: monthSales
            };
        });
    }

    async getTurmaSummary(escolaId?: string, filter: TimeFilter = '7 dias'): Promise<TurmaSummary[]> {
        try {
            const startDate = this.getStartDate(filter);

            let turmasQuery = supabase
                .from('turma')
                .select(`
          id,
          nome,
          quantidade_alunos,
          aluno (
            id,
            saldo_carteira,
            saldo_investido
          )
        `);

            if (escolaId) turmasQuery = turmasQuery.eq('escola_id', escolaId);
            const { data: turmas, error } = await turmasQuery;
            if (error) throw error;

            const { data: spentData } = await supabase
                .from('lojista_historico')
                .select('aluno_id, valor')
                .eq('tipo_operacao', 'VENDA')
                .gte('data_hora', startDate);

            const spentMap = (spentData || []).reduce((acc: any, curr) => {
                if (!curr.aluno_id) return acc;
                acc[curr.aluno_id] = (acc[curr.aluno_id] || 0) + Number(curr.valor);
                return acc;
            }, {});

            // For periodic invested volume
            const { data: investedData } = await supabase
                .from('investimento_aluno')
                .select('aluno_id, valor_investido')
                .gte('created_date', startDate);

            const investedPeriodMap = (investedData || []).reduce((acc: any, curr) => {
                if (!curr.aluno_id) return acc;
                acc[curr.aluno_id] = (acc[curr.aluno_id] || 0) + Number(curr.valor_investido);
                return acc;
            }, {});

            return (turmas || []).map(t => {
                const alumnos = (t.aluno as any[]) || [];
                // "invested" in table usually means volume in period if filtered, or current total? 
                // Let's use volume in period to match the cards.
                const investedVolume = alumnos.reduce((acc, a) => acc + (investedPeriodMap[a.id] || 0), 0);
                const balance = alumnos.reduce((acc, a) => acc + (Number(a.saldo_carteira) || 0), 0);
                const spent = alumnos.reduce((acc, a) => acc + (spentMap[a.id] || 0), 0);

                return {
                    name: t.nome || 'Sem nome',
                    students: t.quantidade_alunos || alumnos.length,
                    invested: investedVolume,
                    spent,
                    balance
                };
            });
        } catch (error) {
            console.error('Error fetching turma summary:', error);
            return [];
        }
    }
}
