import { Injectable } from '@angular/core';
import { supabase } from '../supabase';

export interface WalletStudent {
    id: string;
    aluno_id: string | null;
    numero_carteira: string;
    nome: string;
    turma_nome: string;
    turma_serie: string;
    escola_nome: string;
    escola_id: string;
    saldo_carteira: number;
    status: string;
    user_id: string;
}

export interface StudentFinancialProfile {
    id: string;
    nome: string;
    turma: string;
    status: string;
    saldo_carteira: number;
    saldo_propositos: number;
}

export interface Purpose {
    id: string;
    nome: string;
    saldo: number;
}

export interface InventoryItem {
    id: string;
    produto: string;
    quantidade: number;
    data: string;
    status: string;
}

export interface Transaction {
    id: string;
    tipo: string;
    descricao: string;
    valor: number;
    data: string;
}

@Injectable({
    providedIn: 'root'
})
export class CarteiraService {

    async getStudentsWallet(
        escolaId?: string,
        statusFilter?: string,
        searchTerm?: string,
        page: number = 1,
        pageSize: number = 8,
        turmaId?: string
    ): Promise<{ students: WalletStudent[]; total: number }> {
        try {
            // 1. Query usuarios (Alunos) — no FK joins
            let query = supabase
                .from('usuarios')
                .select('id, nome_completo, status, escola_id, turmaID', { count: 'exact' })
                .eq('tipo_acesso', 'Aluno');

            if (escolaId) {
                query = query.eq('escola_id', escolaId);
            }

            if (turmaId) {
                query = query.eq('turmaID', turmaId);
            }

            if (statusFilter && statusFilter !== 'Todos') {
                const filterVal = statusFilter === 'Ativo' ? 'active' : 'inactive';
                query = query.eq('status', filterVal);
            }

            if (searchTerm && searchTerm.trim()) {
                const term = searchTerm.trim();
                
                // Also search in 'aluno' table for the wallet number
                const { data: matchedByRA } = await supabase
                    .from('aluno')
                    .select('nome')
                    .ilike('numero_carteira', `%${term}%`);
                
                const matchedNames = (matchedByRA || []).map(a => a.nome).filter(Boolean);
                
                if (matchedNames.length > 0) {
                    // Combine name search and wallet number search results
                    // We can't easily join here without breaking the existing flow, so we build an OR query
                    // that covers the searchTerm in the name AND any names that matched the RA search.
                    const matchedNamesSet = [...new Set(matchedNames)];
                    // Constructing the OR filter: name match OR RA-based name match
                    // Supabase .or() with .in() inside can be tricky, so we join names
                    query = query.or(`nome_completo.ilike.%${term}%,nome_completo.in.(${matchedNamesSet.map(n => `"${n}"`).join(',')})`);
                } else {
                    query = query.ilike('nome_completo', `%${term}%`);
                }
            }

            const rangeFrom = (page - 1) * pageSize;
            const rangeTo = rangeFrom + pageSize - 1;
            query = query.range(rangeFrom, rangeTo).order('nome_completo', { ascending: true });

            const { data: usuarios, error, count } = await query;
            if (error) throw error;
            if (!usuarios || usuarios.length === 0) return { students: [], total: count || 0 };

            // 2. Get aluno records for matching escola_ids
            const userEscolaIds = [...new Set(usuarios.map((u: any) => u.escola_id).filter(Boolean))];
            const { data: alunos } = await supabase
                .from('aluno')
                .select('id, nome, numero_carteira, saldo_carteira, escola_id, usuario_id')
                .in('escola_id', userEscolaIds);

            // 3. Get turma names
            const turmaIds = [...new Set(usuarios.map((u: any) => u.turmaID).filter(Boolean))];
            let turmaMap: Record<string, any> = {};
            if (turmaIds.length > 0) {
                const { data: turmas } = await supabase
                    .from('turma')
                    .select('id, nome, serie')
                    .in('id', turmaIds);
                turmaMap = (turmas || []).reduce((acc: any, t: any) => {
                    acc[t.id] = t;
                    return acc;
                }, {});
            }

            // 4. Get escola names
            let escolaMap: Record<string, string> = {};
            if (userEscolaIds.length > 0) {
                const { data: escolas } = await supabase
                    .from('escola')
                    .select('id, nome_fantasia')
                    .in('id', userEscolaIds);
                escolaMap = (escolas || []).reduce((acc: any, e: any) => {
                    acc[e.id] = e.nome_fantasia || '';
                    return acc;
                }, {});
            }

            // 5. Match aluno to usuario by usuario_id OR (nome + escola_id fallback for legacy)
            const students: WalletStudent[] = usuarios.map((u: any) => {
                // Try matching by usuario_id first, then name + school
                const matchedAluno = (alunos || []).find(
                    (a: any) => (a.usuario_id === u.id) || (a.escola_id === u.escola_id && a.nome === u.nome_completo)
                );
                
                const turma = turmaMap[u.turmaID] || {};

                return {
                    id: u.id,
                    aluno_id: matchedAluno?.id || null,
                    numero_carteira: matchedAluno?.numero_carteira || '000000',
                    nome: u.nome_completo || 'Sem nome',
                    turma_nome: turma.nome || '',
                    turma_serie: turma.serie || '',
                    escola_nome: escolaMap[u.escola_id] || '',
                    escola_id: u.escola_id,
                    saldo_carteira: Number(matchedAluno?.saldo_carteira) || 0,
                    status: u.status || 'active',
                    user_id: u.id
                };
            });

            return { students, total: count || 0 };
        } catch (error) {
            console.error('Error fetching wallet students:', error);
            return { students: [], total: 0 };
        }
    }

    async getStudentFinancialProfile(alunoId: string): Promise<StudentFinancialProfile | null> {
        try {
            // Get aluno data (no FK joins)
            const { data: alunoData, error: alunoError } = await supabase
                .from('aluno')
                .select('id, nome, saldo_carteira, escola_id')
                .eq('id', alunoId)
                .single();

            if (alunoError) throw alunoError;

            // Get user status and turmaID separately
            const { data: userData } = await supabase
                .from('usuarios')
                .select('status, turmaID')
                .eq('tipo_acesso', 'Aluno')
                .eq('escola_id', alunoData.escola_id)
                .ilike('nome_completo', `%${alunoData.nome}%`)
                .limit(1)
                .single();

            // Get turma info separately if turmaID exists
            let turmaInfo = '';
            if (userData?.turmaID) {
                const { data: turmaData } = await supabase
                    .from('turma')
                    .select('nome, serie, estagio')
                    .eq('id', userData.turmaID)
                    .single();
                if (turmaData) {
                    turmaInfo = `${turmaData.serie || ''} - ${turmaData.estagio || ''}`;
                }
            }

            const purposes = await this.getStudentPurposes(alunoId);
            const saldoPropositos = purposes.reduce((acc, p) => acc + p.saldo, 0);

            return {
                id: alunoData.id,
                nome: alunoData.nome || 'Sem nome',
                turma: turmaInfo,
                status: userData?.status || 'active',
                saldo_carteira: Number(alunoData.saldo_carteira) || 0,
                saldo_propositos: saldoPropositos
            };
        } catch (error) {
            console.error('Error fetching student financial profile:', error);
            return null;
        }
    }

    async getStudentPurposes(alunoId: string): Promise<Purpose[]> {
        try {
            const { data, error } = await supabase
                .from('propositos')
                .select('id, nome, saldo')
                .eq('aluno_id', alunoId);

            if (error) throw error;
            return (data || []).map((p: any) => ({
                id: p.id,
                nome: p.nome || '',
                saldo: Number(p.saldo) || 0
            }));
        } catch (error) {
            console.error('Error fetching purposes:', error);
            return [];
        }
    }

    async getStudentInventory(
        alunoId: string,
        page: number = 1,
        pageSize: number = 5
    ): Promise<{ items: InventoryItem[]; total: number }> {
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await supabase
                .from('lojista_historico')
                .select('id, produto_nome, quantidade, data_hora, status', { count: 'exact' })
                .eq('aluno_id', alunoId)
                .eq('tipo_operacao', 'COMPRA')
                .order('data_hora', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const items: InventoryItem[] = (data || []).map((i: any) => ({
                id: i.id,
                produto: i.produto_nome || 'Produto',
                quantidade: i.quantidade || 1,
                data: i.data_hora ? new Date(i.data_hora).toLocaleDateString('pt-BR') : '',
                status: i.status || 'pendente'
            }));

            return { items, total: count || 0 };
        } catch (error) {
            console.error('Error fetching inventory:', error);
            return { items: [], total: 0 };
        }
    }

    async getStudentTransactionHistory(
        alunoId: string,
        month?: string,
        page: number = 1,
        pageSize: number = 10
    ): Promise<{ transactions: Transaction[]; total: number }> {
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from('lojista_historico')
                .select('id, tipo_operacao, produto_nome, valor, data_hora', { count: 'exact' })
                .eq('aluno_id', alunoId)
                .order('data_hora', { ascending: false })
                .range(from, to);

            if (month) {
                const [year, m] = month.split('-');
                const startDate = `${year}-${m}-01`;
                const endMonth = parseInt(m) + 1;
                const endDate = endMonth > 12
                    ? `${parseInt(year) + 1}-01-01`
                    : `${year}-${String(endMonth).padStart(2, '0')}-01`;
                query = query.gte('data_hora', startDate).lt('data_hora', endDate);
            }

            const { data, error, count } = await query;
            if (error) throw error;

            const transactions: Transaction[] = (data || []).map((t: any) => ({
                id: t.id,
                tipo: t.tipo_operacao || '',
                descricao: t.produto_nome || t.tipo_operacao || '',
                valor: Number(t.valor) || 0,
                data: t.data_hora ? new Date(t.data_hora).toLocaleDateString('pt-BR') : ''
            }));

            return { transactions, total: count || 0 };
        } catch (error) {
            console.error('Error fetching transaction history:', error);
            return { transactions: [], total: 0 };
        }
    }

    async redeemInventoryItem(itemId: string): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from('lojista_historico')
                .update({ status: 'resgatado' })
                .eq('id', itemId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error redeeming item:', error);
            return { success: false, error };
        }
    }
    async updateStudentWalletBalance(
        alunoId: string, 
        amount: number, 
        alunoNome: string = '', 
        alunoTurma: string = ''
    ): Promise<{ success: boolean; error?: any }> {
        try {
            // 1. Get current balance
            const { data: aluno, error: getError } = await supabase
                .from('aluno')
                .select('saldo_carteira')
                .eq('id', alunoId)
                .single();

            if (getError) throw getError;

            const newBalance = (Number(aluno.saldo_carteira) || 0) + amount;

            // 2. Update balance
            const { error: updateError } = await supabase
                .from('aluno')
                .update({ saldo_carteira: newBalance })
                .eq('id', alunoId);

            if (updateError) throw updateError;

            // 3. Add to history
            const { error: historyError } = await supabase
                .from('lojista_historico')
                .insert({
                    lojista_id: null, // Now nullable per my SQL change
                    aluno_id: alunoId,
                    aluno_nome: alunoNome,
                    aluno_turma: alunoTurma,
                    tipo_operacao: 'REPOSICAO',
                    descricao: 'Adição manual de saldo',
                    valor: amount,
                    data_hora: new Date().toISOString()
                });

            if (historyError) throw historyError;

            return { success: true };
        } catch (error) {
            console.error('Error updating student balance:', error);
            return { success: false, error };
        }
    }
}
