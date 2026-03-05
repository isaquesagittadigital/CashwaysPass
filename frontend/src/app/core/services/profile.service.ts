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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: profile } = await supabase
            .from('usuarios')
            .select('id, nome_completo, email, foto_url, cpf, telefone, tipo_acesso')
            .eq('UserID', user.id)
            .single();

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
        if (!user) throw new Error('Usuário não autenticado');

        const { error } = await supabase
            .from('usuarios')
            .update({
                nome_completo: data.nome_completo,
                email: data.email,
                cpf: data.cpf,
                telefone: data.telefone
            })
            .eq('UserID', user.id);

        if (error) throw error;
    }

    async updateAvatar(file: File): Promise<string> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
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
            .eq('UserID', user.id);

        if (updateError) throw updateError;

        return publicUrl;
    }

    async changePassword(newPassword: string): Promise<void> {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;
    }
}
