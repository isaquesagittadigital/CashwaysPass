import { Injectable } from '@angular/core';
import { supabase } from '../supabase';
import { environment } from '../../../environments/environment';
import { EmailService } from './email.service';

export type UserTipoAcesso = 'Admin' | 'Escola' | 'Professor' | 'Lojista' | 'Aluno' | 'Responsavel' | 'Convidado';
export type UserStatus = 'active' | 'inactive' | 'blocked' | 'invited';

export interface Usuario {
    id: number;
    UserID?: string;
    nome_completo: string;
    nome?: string;
    email: string;
    cpf: string;
    cnpj?: string;
    Proposito_Lojista?: string;
    telefone?: string;
    escola_id: string;
    turmaID?: string;
    turma?: {
        id: string;
        nome: string;
        Periodos?: string;
    };
    tipo_acesso: UserTipoAcesso;
    status: UserStatus;
    ultimo_login?: string;
    data_nascimento?: string;
    nome_mae?: string;
    ra?: string;
    grau_escolaridade?: string;
    created_at?: string;
    updated_at?: string;
}

@Injectable({
    providedIn: 'root'
})
export class UsuarioService {
    constructor(private emailService: EmailService) { }
    private readonly TABLE = 'usuarios';

    async getUsuarios(
        escolaId: string,
        searchTerm?: string,
        tipoAcesso?: string,
        status?: string,
        page: number = 1,
        pageSize: number = 10
    ): Promise<{ users: Usuario[], total: number }> {
        try {
            let query = supabase
                .from(this.TABLE)
                .select('*, turma:turmaID(id, nome, Periodos)', { count: 'exact' })
                .eq('escola_id', escolaId)
                .or('excluido.eq.no,excluido.is.null')
                .order('id', { ascending: false });

            if (searchTerm) {
                query = query.or(`nome_completo.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`);
            }

            if (tipoAcesso) {
                query = query.eq('tipo_acesso', tipoAcesso);
            }

            if (status) {
                query = query.eq('status', status);
            }

            // Pagination
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;
            return {
                users: (data || []) as Usuario[],
                total: count || 0
            };
        } catch (error) {
            console.error('Error fetching users:', error);
            return { users: [], total: 0 };
        }
    }

    async deleteUsuario(id: number): Promise<{ success: boolean; error?: any }> {
        try {
            const { data, error } = await supabase.functions.invoke('admin-delete-users', {
                body: { db_ids: [id] }
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error || 'Erro ao excluir usuário');

            return { success: true };
        } catch (error) {
            console.error('Error deleting user:', error);
            return { success: false, error };
        }
    }

    async deleteBulkUsuarios(ids: number[]): Promise<{ success: boolean; error?: any }> {
        try {
            const { data, error } = await supabase.functions.invoke('admin-delete-users', {
                body: { db_ids: ids }
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error || 'Erro ao excluir usuários');

            return { success: true };
        } catch (error) {
            console.error('Error deleting multiple users:', error);
            return { success: false, error };
        }
    }

    async createUsuario(usuario: Partial<Usuario>): Promise<{ success: boolean; data?: Usuario; error?: any }> {
        try {
            const tempPass = Math.random().toString(36).slice(-10);
            
            const { data: resData, error: fnError } = await supabase.functions.invoke('send-access-email', {
                body: { 
                    email: usuario.email,
                    nome: usuario.nome_completo || usuario.nome,
                    temp_password: tempPass,
                    tipo_acesso: usuario.tipo_acesso,
                    escola_id: usuario.escola_id,
                    cpf: usuario.cpf,
                    telefone: usuario.telefone,
                    turmaID: usuario.turmaID
                }
            });

            if (fnError) throw fnError;
            if (resData && !resData.success) throw new Error(resData.error || 'Erro ao processar usuário');

            const { data: finalUser, error: fetchError } = await supabase
                .from(this.TABLE)
                .select('*')
                .eq('email', usuario.email)
                .single();

            if (fetchError) throw fetchError;

            if (usuario.tipo_acesso === 'Aluno' && finalUser) {
                await this.syncWithAlunoTable(finalUser.id, usuario);
            }

            if ((usuario.tipo_acesso === 'Convidado' || usuario.tipo_acesso === 'Lojista') && finalUser) {
                await this.createRandomWallet(finalUser.id, usuario.escola_id!);
            }

            return { success: true, data: finalUser as Usuario };
        } catch (error) {
            console.error('Error creating/recovering user:', error);
            return { success: false, error };
        }
    }

    private async createRandomWallet(usuarioId: number, escolaId: string) {
        try {
            // Sequência numérica de 8 dígitos
            const carteiraCode = Math.floor(10000000 + Math.random() * 90000000).toString();
            
            const carteiraPayload = {
                Usuario: usuarioId,
                carteira_code: carteiraCode,
                escola_id: escolaId
            };

            const { data: existingCarteira } = await supabase
                .from('carteira')
                .select('id')
                .eq('Usuario', usuarioId)
                .maybeSingle();

            if (!existingCarteira) {
                const { error } = await supabase
                    .from('carteira')
                    .insert(carteiraPayload);

                if (error) {
                    console.error('Erro ao inserir carteira de convidado no DB:', error);
                }
            }
        } catch (err) {
            console.error('Falha ao criar carteira para convidado:', err);
        }
    }

    async updateUsuario(id: number, updates: Partial<Usuario>): Promise<{ success: boolean; error?: any }> {
        try {
            const cleanedUpdates = { ...updates };
            delete (cleanedUpdates as any).turma;
            delete (cleanedUpdates as any).created_at;
            delete (cleanedUpdates as any).updated_at;
            delete (cleanedUpdates as any).ultimo_login;
            delete (cleanedUpdates as any).UserID;
            delete (cleanedUpdates as any).id;

            const { error } = await supabase
                .from(this.TABLE)
                .update(cleanedUpdates)
                .eq('id', id);

            if (error) throw error;

            if (updates.tipo_acesso === 'Aluno') {
                await this.syncWithAlunoTable(id, updates);
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating user:', error);
            return { success: false, error };
        }
    }

    private async syncWithAlunoTable(usuarioId: number, data: Partial<Usuario>) {
        try {
            const alunoUpdates: any = {};
            if (data.nome_completo) {
                alunoUpdates.nome = data.nome_completo;
                alunoUpdates.nome_completo = data.nome_completo;
            }
            if (data.email) alunoUpdates.email = data.email;
            if (data.cpf) alunoUpdates.cpf = data.cpf;
            if (data.turmaID !== undefined) alunoUpdates.turma_id = data.turmaID;
            if (data.escola_id) alunoUpdates.escola_id = data.escola_id;
            if (data.nome_mae) alunoUpdates.nome_mae = data.nome_mae;
            if (data.ra) alunoUpdates.ra = data.ra;
            if (data.data_nascimento) alunoUpdates.data_nascimento = data.data_nascimento;

            if (Object.keys(alunoUpdates).length === 0) return;

            const { error } = await supabase
                .from('aluno')
                .upsert({ 
                    ...alunoUpdates, 
                    usuario_id: usuarioId,
                    primeiro_acesso: false 
                }, { onConflict: 'usuario_id' });

            if (error) {
                console.warn('Erro ao sincronizar com tabela aluno:', error.message);
            }

            if (data.ra) {
                const carteiraPayload = {
                    Usuario: usuarioId,
                    carteira_code: data.ra,
                    turmaID: data.turmaID,
                    escola_id: data.escola_id
                };

                const { data: existingCarteira } = await supabase
                    .from('carteira')
                    .select('id')
                    .eq('Usuario', usuarioId)
                    .single();

                if (existingCarteira) {
                    await supabase
                        .from('carteira')
                        .update(carteiraPayload)
                        .eq('id', existingCarteira.id);
                } else {
                    if (data.ra && data.escola_id) {
                        await supabase
                            .from('carteira')
                            .insert(carteiraPayload);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to sync with related tables:', err);
        }
    }

    async resetPassword(email: string): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error resetting password:', error);
            return { success: false, error };
        }
    }

    async resendWelcomeEmail(user: Usuario): Promise<{ success: boolean; error?: any }> {
        try {
            const tempPass = Math.random().toString(36).slice(-10);
            
            const { data, error } = await supabase.functions.invoke('send-access-email', {
                body: { 
                    email: user.email,
                    nome: user.nome_completo || user.nome,
                    temp_password: tempPass,
                    tipo_acesso: user.tipo_acesso,
                    escola_id: user.escola_id,
                    turmaID: user.turmaID
                }
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error || 'Erro ao reenviar e-mail');

            return { success: true };
        } catch (error) {
            console.error('Error resending welcome email:', error);
            return { success: false, error };
        }
    }

    async getSchools(): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('escola')
                .select('id, nome_fantasia');
            if (error) throw error;
            return (data || []).map(s => ({
                id: s.id,
                nome: s.nome_fantasia || 'Sem Nome'
            }));
        } catch (error) {
            console.error('Error fetching schools:', error);
            return [];
        }
    }

    async getTurmas(escolaId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('turma')
                .select('id, nome, Periodos')
                .eq('escola_id', escolaId);
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching turmas:', error);
            return [];
        }
    }

    async sendWelcomeEmail(email: string, name: string): Promise<{ success: boolean; error?: any }> {
        try {
            const response = await fetch(`${environment.apiUrl}/email/welcome`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, name })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            return { success: true };
        } catch (error: any) {
            console.error('Error sending welcome email:', error);
            return { success: false, error };
        }
    }
}
