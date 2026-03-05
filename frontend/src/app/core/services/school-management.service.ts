import { Injectable } from '@angular/core';
import { supabase } from '../supabase';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface School {
    id: string;
    nome_fantasia: string;
    cnpj: string;
    razao_social: string;
    modelo_contratacao: string;
    serie: string;
    status: 'active' | 'inactive';
    email: string;
    telefone: string;
    created_at: string;
    [key: string]: any;
}

@Injectable({
    providedIn: 'root'
})
export class SchoolManagementService {
    constructor() { }

    getSchools(): Observable<School[]> {
        return from(
            supabase
                .from('escola')
                .select('*')
                .order('nome_fantasia', { ascending: true })
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data || [];
            })
        );
    }

    getSchoolById(id: string): Observable<School> {
        return from(
            supabase
                .from('escola')
                .select('*')
                .eq('id', id)
                .single()
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data;
            })
        );
    }

    updateSchool(id: string, data: Partial<School>): Observable<any> {
        return from(
            supabase
                .from('escola')
                .update(data)
                .eq('id', id)
        );
    }

    deleteSchool(id: string): Observable<any> {
        return from(
            supabase
                .from('escola')
                .delete()
                .eq('id', id)
        );
    }

    // --- TURMA METHODS ---

    getTurmasBySchool(schoolId: string): Observable<any[]> {
        return from(
            supabase
                .from('turma')
                .select('*, professor:professor_id(nome_completo)')
                .eq('escola_id', schoolId)
                .order('nome', { ascending: true })
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data || [];
            })
        );
    }

    createTurma(data: any): Observable<any> {
        return from(
            supabase
                .from('turma')
                .insert(data)
        );
    }

    updateTurma(id: string, data: any): Observable<any> {
        return from(
            supabase
                .from('turma')
                .update(data)
                .eq('id', id)
        );
    }

    deleteTurma(id: string): Observable<any> {
        return from(
            supabase
                .from('turma')
                .delete()
                .eq('id', id)
        );
    }

    // --- PROFESSOR METHODS ---

    getProfessorsBySchool(schoolId: string): Observable<any[]> {
        return from(
            supabase
                .from('usuarios')
                .select('*')
                .eq('escola_id', schoolId)
                .eq('tipo_user', 'Professor')
                .order('nome_completo', { ascending: true })
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data || [];
            })
        );
    }

    createProfessor(data: any): Observable<any> {
        return from(
            supabase
                .from('usuarios')
                .insert(data)
        );
    }

    updateProfessor(id: string, data: any): Observable<any> {
        return from(
            supabase
                .from('usuarios')
                .update(data)
                .eq('id', id)
        );
    }

    deleteProfessor(id: string): Observable<any> {
        return from(
            supabase
                .from('usuarios')
                .delete()
                .eq('id', id)
        );
    }

    // --- STUDENT METHODS ---

    getStudentsBySchool(schoolId: string): Observable<any[]> {
        return from(
            supabase
                .from('usuarios')
                .select('*, aluno:aluno(numero_carteira, responsavel), turma:turmaID(nome, serie)')
                .eq('escola_id', schoolId)
                .eq('tipo_user', 'Aluno')
                .order('nome_completo', { ascending: true })
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data || [];
            })
        );
    }

    async createStudent(data: any): Promise<{ success: boolean; error?: any }> {
        try {
            // 1. Create User entry
            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .insert({
                    nome_completo: data.nome,
                    email: data.emailResponsavel,
                    tipo_user: 'Aluno',
                    status: 'active',
                    escola_id: data.escola_id,
                    turmaID: data.turmaId
                })
                .select()
                .single();

            if (userError) throw userError;

            // 2. Create Aluno entry
            const { error: alunoError } = await supabase
                .from('aluno')
                .insert({
                    user_id: userData.id,
                    escola_id: data.escola_id,
                    nome: data.nome,
                    responsavel: data.responsavel,
                    email_responsavel: data.emailResponsavel,
                    numero_carteira: data.numeroCarteira
                });

            if (alunoError) throw alunoError;
            return { success: true };
        } catch (error) {
            console.error('Create student failed:', error);
            return { success: false, error };
        }
    }

    async createStudentsBulk(schoolId: string, students: any[]): Promise<{ success: boolean; error?: any }> {
        try {
            // This is a complex operation that should probably be handled by a Supabase function (RPC)
            // for atomicity, but we'll do it sequentially here for simplicity in this flow.
            for (const s of students) {
                await this.createStudent({ ...s, escola_id: schoolId });
            }
            return { success: true };
        } catch (error) {
            console.error('Bulk insert failed:', error);
            return { success: false, error };
        }
    }

    deleteStudent(id: string): Observable<any> {
        return from(
            supabase
                .from('usuarios')
                .delete()
                .eq('id', id)
        );
    }
}
