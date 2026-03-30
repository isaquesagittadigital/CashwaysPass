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
    categoria: string;
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
        turmaId?: string,
        tipoAcesso: string = 'Aluno'
    ): Promise<{ students: WalletStudent[]; total: number }> {
        try {
            // 1. Query usuarios (Alunos) — no FK joins
            let query = supabase
                .from('usuarios')
                .select('id, nome_completo, status, escola_id, turmaID, saldo_carteira', { count: 'exact' })
                .eq('tipo_acesso', tipoAcesso);

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
                
                // Search in 'aluno' table for RA and 'Carteira' table for carteira_code
                const [matchedByRA, matchedByCode] = await Promise.all([
                    supabase.from('aluno').select('nome').ilike('ra', `%${term}%`),
                    supabase.from('carteira').select('Usuario').ilike('carteira_code', `%${term}%`)
                ]);
                
                const matchedNamesFromRA = (matchedByRA.data || []).map(a => a.nome).filter(Boolean);
                const matchedUserIdsFromCode = (matchedByCode.data || []).map(c => c.Usuario).filter(Boolean);
                
                let orConditions = [`nome_completo.ilike.%${term}%`];
                
                if (matchedNamesFromRA.length > 0) {
                    const names = matchedNamesFromRA.map(n => `"${n}"`).join(',');
                    orConditions.push(`nome_completo.in.(${names})`);
                }
                
                if (matchedUserIdsFromCode.length > 0) {
                    const ids = matchedUserIdsFromCode.join(',');
                    orConditions.push(`id.in.(${ids})`);
                }
                
                query = query.or(orConditions.join(','));
            }

            const rangeFrom = (page - 1) * pageSize;
            const rangeTo = rangeFrom + pageSize - 1;
            query = query.range(rangeFrom, rangeTo).order('nome_completo', { ascending: true });

            const { data: usuarios, error, count } = await query;
            if (error) throw error;
            if (!usuarios || usuarios.length === 0) return { students: [], total: count || 0 };

            const userIds = usuarios.map((u: any) => u.id);
            const userEscolaIds = [...new Set(usuarios.map((u: any) => u.escola_id).filter(Boolean))];

            // 2. Get aluno records and Carteira records in parallel
            const [alunosRes, carteirasRes] = await Promise.all([
                supabase
                    .from('aluno')
                    .select('id, nome, ra, saldo_carteira, escola_id, usuario_id')
                    .in('usuario_id', userIds),
                supabase
                    .from('carteira')
                    .select('carteira_code, Usuario')
                    .in('Usuario', userIds)
            ]);

            const alunos = alunosRes.data || [];
            const carteiras = carteirasRes.data || [];

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

            // 5. Build lookup maps for speed
            const carteiraMap = carteiras.reduce((acc: any, c: any) => {
                acc[c.Usuario] = c.carteira_code;
                return acc;
            }, {});

            // 5. Match aluno to usuario
            const students: WalletStudent[] = usuarios.map((u: any) => {
                const matchedAluno = alunos.find((a: any) => a.usuario_id === u.id);
                const turma = turmaMap[u.turmaID] || {};
                
                // Priority for wallet code: Carteira table > Aluno.ra > Default
                const walletCode = carteiraMap[u.id] || matchedAluno?.ra || '000000';
                
                // Priority for balance: Usuario table (primary) — fallback to Aluno if needed
                const balance = (Number(u.saldo_carteira) !== 0) ? Number(u.saldo_carteira) : (Number(matchedAluno?.saldo_carteira) || 0);

                return {
                    id: String(u.id),
                    aluno_id: matchedAluno?.id || null,
                    numero_carteira: walletCode,
                    nome: u.nome_completo || 'Sem nome',
                    turma_nome: turma.nome || '',
                    turma_serie: turma.serie || '',
                    escola_nome: escolaMap[u.escola_id] || '',
                    escola_id: u.escola_id,
                    saldo_carteira: balance,
                    status: u.status || 'active',
                    user_id: String(u.id)
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
            // Check if alunoId is a UUID or a numeric ID (usuario_id)
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alunoId);
            
            // Get aluno data
            let query = supabase.from('aluno').select('id, nome, saldo_carteira, escola_id, usuario_id, user_id');
            
            if (isUuid) {
                query = query.eq('id', alunoId);
            } else {
                query = query.eq('usuario_id', alunoId);
            }

            const { data: alunoData, error: alunoError } = await query.single();

            if (alunoError) throw alunoError;

            // Get user status and UserID using the usuario_id (Integer) link
            const { data: userData } = await supabase
                .from('usuarios')
                .select('status, turmaID, UserID, saldo_carteira')
                .eq('id', alunoData.usuario_id)
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

            const purposes = await this.getStudentPurposes(userData?.UserID || alunoData.user_id || '');
            const saldoPropositos = purposes.reduce((acc, p) => acc + p.saldo, 0);

            return {
                id: alunoData.id,
                nome: alunoData.nome || 'Sem nome',
                turma: turmaInfo,
                status: userData?.status || 'active',
                saldo_carteira: userData ? (Number(userData.saldo_carteira) || 0) : (Number(alunoData.saldo_carteira) || 0),
                saldo_propositos: saldoPropositos
            };
        } catch (error) {
            console.error('Error fetching student financial profile:', error);
            return null;
        }
    }

    async getStudentPurposes(userId: string): Promise<Purpose[]> {
        if (!userId) return [];
        try {
            // First treat userId as the Auth UUID (usuario_id in propositos)
            let { data, error } = await supabase
                .from('propositos')
                .select('id, nome, saldo')
                .eq('usuario_id', userId);

            // Fallback: If no data found and userId looks like a UUID (could be an aluno.id)
            if ((!data || data.length === 0) && userId.includes('-')) {
                // 1. Check if it's an aluno.id and get its usuario_id
                const { data: alunoLink } = await supabase
                    .from('aluno')
                    .select('usuario_id')
                    .eq('id', userId)
                    .limit(1);
                
                let actualAuthUuid = '';
                
                if (alunoLink && alunoLink[0]?.usuario_id) {
                    // 2. Get UserID from usuarios using that integer link
                    const { data: userLink } = await supabase
                        .from('usuarios')
                        .select('UserID')
                        .eq('id', alunoLink[0].usuario_id)
                        .limit(1);
                    
                    if (userLink && userLink[0]?.UserID) {
                        actualAuthUuid = userLink[0].UserID;
                    }
                }

                if (actualAuthUuid && actualAuthUuid !== userId) {
                    const retry = await supabase
                        .from('propositos')
                        .select('id, nome, saldo')
                        .eq('usuario_id', actualAuthUuid);
                    data = retry.data;
                }
            }

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
                .select('id, descricao, data_hora, status', { count: 'exact' })
                .eq('aluno_id', alunoId)
                .eq('tipo_operacao', 'VENDA')
                .order('data_hora', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const items: InventoryItem[] = (data || []).map((i: any) => ({
                id: i.id,
                produto: i.descricao || 'Produto',
                quantidade: 1, // lojista_historico doesn't have quantity, defaulting to 1
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
                .from('investimento_aluno')
                .select('id, titulo, descricao, valor, valor_investido, created_date, categoria', { count: 'exact' })
                .eq('aluno_id', alunoId)
                .order('created_date', { ascending: false })
                .range(from, to);

            if (month) {
                const [year, m] = month.split('-');
                const startDate = `${year}-${m}-01`;
                const endMonth = parseInt(m) + 1;
                const endDate = endMonth > 12
                    ? `${parseInt(year) + 1}-01-01`
                    : `${year}-${String(endMonth).padStart(2, '0')}-01`;
                query = query.gte('created_date', startDate).lt('created_date', endDate);
            }

            const { data, error, count } = await query;
            if (error) throw error;

            const transactions: Transaction[] = (data || []).map((t: any) => {
                const valor = Number(t.valor || t.valor_investido) || 0;
                // Determine if it's a credit or debit. Aportes are usually credits (+)
                const tituloStr = String(t.titulo || '').toLowerCase();
                const descStr = String(t.descricao || '').toLowerCase();
                const isDebit = tituloStr.includes('compra') || tituloStr.includes('venda') || descStr.includes('compra') || descStr.includes('venda') || (valor < 0);
                const isCredit = !isDebit;

                let categoria = t.categoria && t.categoria !== 'Log' ? t.categoria : 'Log';
                
                // Fallback analysis for historical records missing an accurate Enum type
                if (categoria === 'Log') {
                    if (tituloStr.includes('entrada') || descStr.includes('dição') || descStr.includes('depósito') || descStr.includes('pix')) categoria = 'Entrada';
                    else if (tituloStr.includes('crédito') || descStr.includes('credito') || tituloStr.includes('saldo') || descStr.includes('saldo')) categoria = 'Crédito';
                    else if (tituloStr.includes('reserva') || descStr.includes('reserva')) categoria = 'Minha Reserva';
                    else if (tituloStr.includes('devolu') || descStr.includes('devolu')) categoria = 'Devolução';
                    else if (tituloStr.includes('mercado') || descStr.includes('mercado')) categoria = 'Mercado';
                    else if (tituloStr.includes('alimenta') || descStr.includes('alimenta')) categoria = 'Alimentação';
                    else if (tituloStr.includes('entretenimento') || descStr.includes('entretenimento')) categoria = 'Entretenimento';
                    else if (tituloStr.includes('compra') || descStr.includes('compra')) categoria = 'Compra';
                    else if (tituloStr.includes('venda') || descStr.includes('venda')) categoria = 'Venda';
                    else if (tituloStr.includes('movimenta') || descStr.includes('movimenta')) categoria = 'Movimentação';
                    else if (isCredit) categoria = 'Entrada';
                    else categoria = 'Venda';
                }

                return {
                    id: t.id,
                    tipo: isCredit ? 'REPOSICAO' : 'VENDA',
                    categoria: categoria,
                    descricao: t.descricao || t.titulo || 'Movimentação',
                    valor: Math.abs(valor),
                    data: t.created_date ? new Date(t.created_date).toLocaleDateString('pt-BR') : ''
                };
            });

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
    ): Promise<{ success: boolean; aluno_id?: string; new_balance?: number; error?: any }> {
        try {
            // Check if alunoId is a UUID or a numeric ID (usuario_id)
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alunoId);
            
            // 1. Get current balance and info
            let query = supabase.from('aluno').select('id, saldo_carteira, usuario_id, escola_id');
            
            if (isUuid) {
                query = query.eq('id', alunoId);
            } else {
                query = query.eq('usuario_id', alunoId);
            }
            
            let { data: alunoFound, error: getError } = await query.single();

            let targetUuid: string;
            let targetUsuarioId: number | string | null = null;
            let targetEscolaId: string | null = null;
            let currentBalance: number = 0;

            if (getError || !alunoFound) {
                // If not found in 'aluno' table, we MUST find the user in 'usuarios' to get required info
                const { data: user, error: userError } = await supabase
                    .from('usuarios')
                    .select('id, nome_completo, escola_id, turmaID, saldo_carteira')
                    .eq('id', isUuid ? 0 : alunoId) 
                    .single();
                
                if (userError || !user) throw new Error('Aluno não encontrado para atualização de saldo.');

                // Create the aluno record
                const { data: newAluno, error: createError } = await supabase
                    .from('aluno')
                    .insert({
                        usuario_id: user.id,
                        nome: user.nome_completo,
                        escola_id: user.escola_id,
                        turma_id: user.turmaID,
                        saldo_carteira: Number(user.saldo_carteira) || 0
                    })
                    .select('id, saldo_carteira, usuario_id, escola_id')
                    .single();

                if (createError || !newAluno) throw createError;
                
                alunoFound = newAluno;
                targetUuid = newAluno.id;
                targetUsuarioId = newAluno.usuario_id;
                targetEscolaId = newAluno.escola_id;
                currentBalance = Number(newAluno.saldo_carteira) || 0;
            } else {
                targetUuid = alunoFound.id;
                targetUsuarioId = alunoFound.usuario_id;
                targetEscolaId = alunoFound.escola_id;
                currentBalance = Number(alunoFound.saldo_carteira) || 0;
            }

            const newBalance = currentBalance + amount;

            // 2. Update balances and History IN PARALLEL for speed
            const updatePromises: any[] = [];

            // Update aluno table
            updatePromises.push(
                supabase.from('aluno').update({ saldo_carteira: newBalance }).eq('id', targetUuid)
            );

            // Update usuarios table
            if (targetUsuarioId) {
                updatePromises.push(
                    supabase.from('usuarios').update({ saldo_carteira: newBalance }).eq('id', targetUsuarioId)
                );
            }

            // Add history record in investimento_aluno
            const historyData = {
                aluno_id: targetUuid,
                escola_id: targetEscolaId,
                titulo: 'REPOSICAO',
                descricao: 'Adição manual de saldo',
                valor: amount,
                status_investimento: 'Ativo',
                categoria: 'Entrada',
                created_date: new Date().toISOString(),
                data_inicio: new Date().toISOString().split('T')[0]
            };
            updatePromises.push(supabase.from('investimento_aluno').insert(historyData));

            // Add log in movimentacao_financeira (Solicitado pelo usuário)
            const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const currentMonth = monthNames[new Date().getMonth()];

            const movimentacaoData = {
                aluno_id: targetUuid,
                tipo_operacao: 'ADICAO_MANUAL',
                categoria: 'credito',
                nome_operacao: 'Saldo Adicionado Manualmente',
                mes_operacao: currentMonth,
                valor: amount,
                status: 'CONCLUIDO',
                request_payload: { 
                    aluno_id: targetUuid, 
                    amount, 
                    type: 'MANUAL_ADMIN',
                    aluno_nome: alunoNome
                },
                response_payload: { 
                    mensagem: 'Crédito manual realizado via painel administrativo',
                    aluno: alunoNome,
                    escola_id: targetEscolaId
                },
                http_status: 200
            };
            updatePromises.push(supabase.from('movimentacao_financeira').insert(movimentacaoData));

            // Wait for all operations to complete
            const results = await Promise.all(updatePromises);
            
            // Check for errors in parallel results
            for (const res of results) {
                if (res.error) throw res.error;
            }

            return { 
                success: true, 
                aluno_id: targetUuid,
                new_balance: newBalance 
            };
        } catch (error) {
            console.error('Error updating student balance:', error);
            return { success: false, error };
        }
    }
}
