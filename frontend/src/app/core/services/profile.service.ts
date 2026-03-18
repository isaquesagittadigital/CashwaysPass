import { Injectable } from '@angular/core';
import { supabase } from '../supabase';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserProfile {
    id: string;
    nome_completo: string;
    email: string;
    foto_url?: string;
    foto_perfil?: string;
    cpf?: string;
    telefone?: string;
    cargo?: string;
    escola_id?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ProfileService {
    private currentUserSubject = new BehaviorSubject<UserProfile | null>(this.getInitialUser());
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor() {
        // Inicializa o estado reativo
        this.refreshProfile();
    }

    private getInitialUser(): UserProfile | null {
        const stored = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                return {
                    ...user,
                    foto_url: user.foto_url || user.foto_perfil
                };
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    async refreshProfile(): Promise<void> {
        const profile = await this.getProfile();
        if (profile) {
            this.currentUserSubject.next(profile);
        }
    }
    async getProfile(): Promise<UserProfile | null> {
        let profile = null;

        // Try Supabase Auth first
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const { data, error } = await supabase
                .from('usuarios')
                .select('id, nome_completo, email, foto_perfil, cpf, telefone, tipo_acesso, escola_id')
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
                    .select('id, nome_completo, email, foto_perfil, cpf, telefone, tipo_acesso, escola_id')
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
                foto_url: profile.foto_perfil, // Mapeia a coluna DB para o campo da interface
                cargo: profile.tipo_acesso
            };
        }
        return null;
    }

    private updateLocalCache(updateData: Partial<UserProfile>) {
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

        // Emite o novo estado para os componentes assinantes
        this.currentUserSubject.next(this.getInitialUser());
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

        this.updateLocalCache(updateData);
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
            .update({ foto_perfil: publicUrl })
            .eq(queryField, targetId);

        if (updateError) throw updateError;

        // Atualiza cache local para refletir a nova imagem sem precisar de refresh de página
        this.updateLocalCache({ foto_url: publicUrl });

        return publicUrl;
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        let targetId = null;
        let idColumn = 'id';

        if (user) {
            const { data: userData } = await supabase.from('usuarios').select('id, senha').eq('UserID', user.id).maybeSingle();
            if (userData) {
                targetId = user.id;
                idColumn = 'UserID';
                if (userData.senha !== currentPassword) throw new Error('A senha atual informada está incorreta.');
            }
        }
        
        if (!targetId) {
            const storedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                targetId = userData.id;
                idColumn = 'id';
                
                const { data: pData } = await supabase.from('usuarios').select('senha').eq('id', targetId).maybeSingle();
                if (!pData || pData.senha !== currentPassword) {
                    throw new Error('A senha atual informada está incorreta.');
                }
            }
        }

        if (!targetId) throw new Error('Usuário autenticado não encontrado.');

        // Update local auth table
        const { error } = await supabase
            .from('usuarios')
            .update({ senha: newPassword })
            .eq(idColumn, targetId);

        if (error) throw error;

        // Update Supabase Auth if applicable
        if (user) {
            await supabase.auth.updateUser({
                password: newPassword
            });
        }
    }
}
