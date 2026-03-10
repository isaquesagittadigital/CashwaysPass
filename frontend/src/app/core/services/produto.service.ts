import { Injectable } from '@angular/core';
import { supabase, supabaseUrl, supabaseKey } from '../supabase';

export interface Produto {
    id: string;
    escola_id: string;
    nome: string;
    descricao: string;
    preco: number;
    categoria: string;
    url_imagem: string;
    data_vigencia_inicio: string;
    data_vigencia_final: string;
    limite_por_aluno: number;
    status: boolean;
    turma_ids: string[];
    quantidade: number;
}

export interface ProdutoForm {
    nome: string;
    descricao: string;
    preco: number;
    categoria: string;
    url_imagem: string;
    data_vigencia_inicio: string;
    data_vigencia_final: string;
    limite_por_aluno: number;
    status: boolean;
    turma_ids: string[];
    quantidade: number;
}

@Injectable({
    providedIn: 'root'
})
export class ProdutoService {

    async getProducts(
        escolaId?: string,
        searchTerm?: string,
    ): Promise<Produto[]> {
        try {
            let query = supabase
                .from('produto')
                .select('*')
                .order('nome', { ascending: true });

            if (escolaId) {
                query = query.eq('escola_id', escolaId);
            }

            if (searchTerm && searchTerm.trim()) {
                query = query.ilike('nome', `%${searchTerm}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data || []).map((p: any) => ({
                id: p.id,
                escola_id: p.escola_id,
                nome: p.nome || '',
                descricao: p.descricao || '',
                preco: Number(p.preco) || 0,
                categoria: p.categoria || 'Geral',
                url_imagem: p.url_imagem || '',
                data_vigencia_inicio: p['Data_vigencia_incio'] || '',
                data_vigencia_final: p['Data_vigencia_final'] || '',
                limite_por_aluno: Number(p['limete_por_aluno']) || 0,
                status: p['Status'] ?? true,
                turma_ids: p.turma_ids || [],
                quantidade: Number(p.quantidade) || 0,
            }));
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    }

    async getProductById(id: string): Promise<Produto | null> {
        try {
            const { data, error } = await supabase
                .from('produto')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            return {
                id: data.id,
                escola_id: data.escola_id,
                nome: data.nome || '',
                descricao: data.descricao || '',
                preco: Number(data.preco) || 0,
                categoria: data.categoria || 'Geral',
                url_imagem: data.url_imagem || '',
                data_vigencia_inicio: data['Data_vigencia_incio'] || '',
                data_vigencia_final: data['Data_vigencia_final'] || '',
                limite_por_aluno: Number(data['limete_por_aluno']) || 0,
                status: data['Status'] ?? true,
                turma_ids: data.turma_ids || [],
                quantidade: Number(data.quantidade) || 0,
            };
        } catch (error) {
            console.error('Error fetching product:', error);
            return null;
        }
    }

    async createProduct(product: ProdutoForm, escolaId: string): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from('produto')
                .insert({
                    escola_id: escolaId,
                    nome: product.nome,
                    descricao: product.descricao,
                    preco: product.preco,
                    url_imagem: product.url_imagem,
                    'Data_vigencia_incio': product.data_vigencia_inicio,
                    'Data_vigencia_final': product.data_vigencia_final,
                    'limete_por_aluno': product.limite_por_aluno,
                    'Status': product.status,
                    turma_ids: product.turma_ids,
                    quantidade: product.quantidade
                });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error creating product:', error);
            return { success: false, error };
        }
    }

    async updateProduct(id: string, product: ProdutoForm): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from('produto')
                .update({
                    nome: product.nome,
                    descricao: product.descricao,
                    preco: product.preco,
                    url_imagem: product.url_imagem,
                    'Data_vigencia_incio': product.data_vigencia_inicio,
                    'Data_vigencia_final': product.data_vigencia_final,
                    'limete_por_aluno': product.limite_por_aluno,
                    'Status': product.status,
                    turma_ids: product.turma_ids,
                    quantidade: product.quantidade
                })
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error updating product:', error);
            return { success: false, error };
        }
    }

    async deleteProduct(id: string): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from('produto')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting product:', error);
            return { success: false, error };
        }
    }

    async uploadProductImage(file: File): Promise<string> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const { data, error } = await supabase.storage
                .from('produtos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: urlData } = supabase.storage
                .from('produtos')
                .getPublicUrl(data.path);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            return '';
        }
    }
}
