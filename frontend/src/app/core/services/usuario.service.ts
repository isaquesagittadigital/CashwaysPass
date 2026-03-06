import { Injectable } from '@angular/core';
import { supabase } from '../supabase';

export type UserTipoAcesso = 'Administrador' | 'Escola' | 'Professor' | 'Lojista' | 'Aluno' | 'Responsável';
export type UserStatus = 'Ativo' | 'Inativo';

export interface Usuario {
    id: number;
    UserID?: string;
    nome_completo: string;
    nome?: string;
    email: string;
    cpf: string;
    escola_id: string;
    turmaID?: string;
    tipo_acesso: UserTipoAcesso;
    status: UserStatus;
    ultimo_login?: string;
    created_at?: string;
    updated_at?: string;
}

@Injectable({
    providedIn: 'root'
})
export class UsuarioService {
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
                .select('*', { count: 'exact' })
                .eq('escola_id', escolaId)
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
            const { error } = await supabase
                .from(this.TABLE)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting user:', error);
            return { success: false, error };
        }
    }

    async deleteBulkUsuarios(ids: number[]): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from(this.TABLE)
                .delete()
                .in('id', ids);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting multiple users:', error);
            return { success: false, error };
        }
    }

    async createUsuario(usuario: Partial<Usuario>): Promise<{ success: boolean; data?: Usuario; error?: any }> {
        try {
            const { data, error } = await supabase
                .from(this.TABLE)
                .insert([usuario])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data: data as Usuario };
        } catch (error) {
            console.error('Error creating user:', error);
            return { success: false, error };
        }
    }

    async updateUsuario(id: number, updates: Partial<Usuario>): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from(this.TABLE)
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error updating user:', error);
            return { success: false, error };
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

    // Helper to fetch schools for the dropdown
    async getSchools(): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('escola')
                .select('id, nome');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching schools:', error);
            return [];
        }
    }

    // Helper to fetch turmas/períodos
    async getTurmas(escolaId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('turma')
                .select('id, nome')
                .eq('escola_id', escolaId);
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching turmas:', error);
            return [];
        }
    }
}
