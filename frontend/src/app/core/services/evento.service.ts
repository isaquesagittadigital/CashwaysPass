import { Injectable } from '@angular/core';
import { supabase } from '../supabase';

export interface Evento {
    id: string;
    escola_id: string;
    nome: string;
    descricao_curta: string;
    data_evento: string;
    capa_url: string;
    ativo: boolean;
    turma_id?: string; // Optional for backward compatibility
    turma_ids?: string[]; // New field for multiple turmas
    lojistas_convidados: string[];
    created_at?: string;
    updated_at?: string;
}

@Injectable({
    providedIn: 'root'
})
export class EventoService {
    private readonly TABLE = 'eventos';
    private readonly BUCKET = 'produtos'; // Using same bucket as products for consistency or I can create 'eventos'

    async getEventos(escolaId: string, searchTerm?: string, status?: string): Promise<Evento[]> {
        try {
            let query = supabase
                .from(this.TABLE)
                .select('*')
                .eq('escola_id', escolaId)
                .order('created_at', { ascending: false });

            if (searchTerm) {
                query = query.ilike('nome', `%${searchTerm}%`);
            }

            if (status === 'Agendado') {
                query = query.eq('ativo', true);
            } else if (status === 'Realizado') {
                query = query.eq('ativo', false);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching events:', error);
            return [];
        }
    }

    async getEventById(id: string): Promise<Evento | null> {
        try {
            const { data, error } = await supabase
                .from(this.TABLE)
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching event by id:', error);
            return null;
        }
    }

    async createEvento(evento: Partial<Evento>): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from(this.TABLE)
                .insert([evento]);

            if (error) throw error;

            // Busca os dados da escola para disparar o e-mail
            if (evento.escola_id) {
                const { data: escolaData } = await supabase
                    .from('escola')
                    .select('nome_fantasia, email_escola')
                    .eq('id', evento.escola_id)
                    .single();

                if (escolaData && escolaData.email_escola) {
                    try {
                        const apiUrl = window.location.hostname.includes('localhost')
                            ? 'http://localhost:3000/email/send-event-invite'
                            : 'https://pass-2-0.vercel.app/api/email/send-event-invite'; // Ajuste caso sua URL de api de produção seja diferente

                        console.log('Disparando e-mail para a escola: ', escolaData.email_escola);

                        await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                to: escolaData.email_escola,
                                schoolName: escolaData.nome_fantasia,
                                eventName: evento.nome || 'Novo Evento',
                                eventDate: evento.data_evento || new Date().toISOString()
                            })
                        }).catch(e => console.error('Erro ao chamar API de E-mail: ', e));
                    } catch (e) {
                        console.error('Falha interna no trigger de e-mail.', e);
                    }
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Error creating event:', error);
            return { success: false, error };
        }
    }

    async updateEvento(id: string, updates: Partial<Evento>): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from(this.TABLE)
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error updating event:', error);
            return { success: false, error };
        }
    }

    async deleteEvento(id: string): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from(this.TABLE)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting event:', error);
            return { success: false, error };
        }
    }

    async uploadCapa(file: File): Promise<string> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `capas/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

            const { data, error } = await supabase.storage
                .from(this.BUCKET)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: urlData } = supabase.storage
                .from(this.BUCKET)
                .getPublicUrl(data.path);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading capa:', error);
            return '';
        }
    }

    async getTurmas(escolaId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('turma')
                .select('id, nome')
                .eq('escola_id', escolaId)
                .eq('status', true);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching turmas:', error);
            return [];
        }
    }
}
