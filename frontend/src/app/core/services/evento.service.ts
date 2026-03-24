import { Injectable } from '@angular/core';
import { supabase } from '../supabase';
import { environment } from '../../../environments/environment';

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
    todas_turmas?: boolean; // New field for all turmas
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

    async createEvento(evento: Partial<Evento>): Promise<{ success: boolean; data?: any; error?: any }> {
        try {
            const { data, error } = await supabase
                .from(this.TABLE)
                .insert([evento])
                .select()
                .single();

            if (error) throw error;

            // Busca os dados da escola para disparar o e-mail
            if (evento.escola_id) {
                const { data: escolaData } = await supabase
                    .from('escola')
                    .select('nome_fantasia, email_contato')
                    .eq('id', evento.escola_id)
                    .single();

                if (escolaData && escolaData.email_contato) {
                    try {
                        const apiUrl = `${environment.apiUrl}/email/send-event-invite`;

                        await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                to: escolaData.email_contato,
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

            if (evento.lojistas_convidados && evento.lojistas_convidados.length > 0) {
                try {
                    await supabase.functions.invoke('process-event-invitations', {
                        body: {
                            eventId: data.id,
                            escolaId: evento.escola_id,
                            lojistasEmails: evento.lojistas_convidados
                        }
                    });
                } catch (fnError) {
                    console.error('Erro ao invocar process-event-invitations:', fnError);
                }
            }

            return { success: true, data };
        } catch (error) {
            console.error('Error creating event:', error);
            return { success: false, error };
        }
    }

    async updateEvento(id: string, updates: Partial<Evento>): Promise<{ success: boolean; error?: any }> {
        try {
            const { data, error } = await supabase
                .from(this.TABLE)
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            if (updates.lojistas_convidados && updates.lojistas_convidados.length > 0) {
                try {
                    await supabase.functions.invoke('process-event-invitations', {
                        body: {
                            eventId: id,
                            escolaId: updates.escola_id || data?.escola_id,
                            lojistasEmails: updates.lojistas_convidados
                        }
                    });
                } catch (fnErr) {
                    console.error('Erro ao invocar process-event-invitations update:', fnErr);
                }
            }
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
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `capas/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

            const { data, error } = await supabase.storage
                .from(this.BUCKET)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Supabase Storage Error (Events):', error);
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from(this.BUCKET)
                .getPublicUrl(data.path);

            return publicUrl;
        } catch (error) {
            console.error('Error uploading capa:', error);
            throw error;
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
