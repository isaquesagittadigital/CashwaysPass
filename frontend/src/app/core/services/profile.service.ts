import { Injectable } from '@angular/core';
import { supabase } from '../supabase';
import { User } from '@supabase/supabase-js';

export interface UserProfile {
    id: string;
    nome_completo: string;
    email: string;
    foto_url?: string;
    cpf?: string;
    telefone?: string;
    cargo?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ProfileService {
    async getProfile(): Promise<UserProfile | null> {
        let profile = null;

        // Try Supabase Auth first
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const { data, error } = await supabase
                .from('usuarios')
                .select('id, nome_completo, email, foto_url, cpf, telefone, tipo_acesso')
                .eq('UserID', user.id)
                .maybeSingle(); // maybeSingle para não lançar erro se não encontrar

            if (!error && data) {
                profile = data;
            }
        }

        // Se não achou por Auth, tenta pelo localStorage (fallback login manual)
        if (!profile) {
            const storedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                const { data, error } = await supabase
                    .from('usuarios')
                    .select('id, nome_completo, email, foto_url, cpf, telefone, tipo_acesso')
                    .eq('id', userData.id)
                    .maybeSingle();
                
                if (!error && data) {
                    profile = data;
                } else {
                    profile = userData;
                }
            }
        }

        if (profile) {
            return {
                ...profile,
                cargo: profile.tipo_acesso
            };
        }
        return null;
    }

    async updateProfile(data: Partial<UserProfile>): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        
        let targetId = null;
        let idColumn = 'id';

        // Tenta achar qual é a coluna do usuário
        if (user) {
            const { data: userData } = await supabase.from('usuarios').select('id').eq('UserID', user.id).maybeSingle();
            if (userData) {
                targetId = user.id;
                idColumn = 'UserID';
            }
        }
        
        // Fallback local storage
        if (!targetId) {
            const storedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
            if (storedUser) {
                targetId = JSON.parse(storedUser).id;
                idColumn = 'id';
            }
        }

        if (!targetId) throw new Error('Usuário não encontrado.');

        const updateData = {
            nome_completo: data.nome_completo,
            email: data.email,
            cpf: data.cpf,
            telefone: data.telefone
        };

        const { error } = await supabase
            .from('usuarios')
            .update(updateData)
            .eq(idColumn, targetId);

        if (error) throw error;

        // Atualiza a cache no localStorage para refletir em outras partes do app
        const storedLocal = localStorage.getItem('currentUser');
        if (storedLocal) {
            const parsedLocal = JSON.parse(storedLocal);
            localStorage.setItem('currentUser', JSON.stringify({ ...parsedLocal, ...updateData }));
        }
        
        const storedSession = sessionStorage.getItem('currentUser');
        if (storedSession) {
            const parsedSession = JSON.parse(storedSession);
            sessionStorage.setItem('currentUser', JSON.stringify({ ...parsedSession, ...updateData }));
        }
    }

    async updateAvatar(file: File): Promise<string> {
        const { data: { user } } = await supabase.auth.getUser();
        let targetId;
        let queryField: 'UserID' | 'id' = 'UserID';

        if (user) {
            targetId = user.id;
        } else {
            const storedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
            if (!storedUser) throw new Error('Usuário não autenticado');
            targetId = JSON.parse(storedUser).id;
            queryField = 'id';
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${targetId}-${Math.random()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('usuarios')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('usuarios')
            .getPublicUrl(filePath);

        const { error: updateError } = await supabase
            .from('usuarios')
            .update({ foto_url: publicUrl })
            .eq(queryField, targetId);

        if (updateError) throw updateError;

        return publicUrl;
    }

    async changePassword(newPassword: string): Promise<void> {
        // In the current implementation, login is manual via 'senha' column in 'usuarios'
        const storedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            const { error } = await supabase
                .from('usuarios')
                .update({ senha: newPassword })
                .eq('id', userData.id);
            if (error) throw error;
        }

        // Also update Supabase Auth if applicable
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.auth.updateUser({
                password: newPassword
            });
        }
    }
}
