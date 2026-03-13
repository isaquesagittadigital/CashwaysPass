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
    tipo_escola: string;
    status: 'active' | 'inactive';
    email_contato: string;
    telefone_contato: string;
    whatsapp: string;
    endereco: string;
    responsavel_direcao: string;
    nome_secretariado: string;
    email_secretaria_admin: string;
    cep: string;
    complemento: string;
    valor_carteira: number;
    valor_transferencia: number;
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
                .eq('deletado', false)
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
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data;
            })
        );
    }

    deleteSchool(id: string): Observable<any> {
        return from(
            supabase
                .from('escola')
                .update({ deletado: true, status: 'inactive' })
                .eq('id', id)
        );
    }

    // --- TURMA METHODS ---

    getTurmasBySchool(schoolId: string): Observable<any[]> {
        return from(
            supabase
                .from('turma')
                .select('*')
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
                .select()
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data;
            })
        );
    }

    updateTurma(id: string, data: any): Observable<any> {
        return from(
            supabase
                .from('turma')
                .update(data)
                .eq('id', id)
                .select()
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data;
            })
        );
    }

    deleteTurma(id: string): Observable<any> {
        return from(
            supabase
                .from('turma')
                .delete()
                .eq('id', id)
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data;
            })
        );
    }

    // --- PROFESSOR METHODS ---

    getProfessorsBySchool(schoolId: string, turmaId?: string): Observable<any[]> {
        let query = supabase
            .from('usuarios')
            .select('*')
            .eq('escola_id', schoolId)
            .eq('tipo_acesso', 'Professor')
            .not('deleted', 'eq', true);

        if (turmaId) {
            // Se houver lógica de vinculação professor_turma, aplicar aqui. 
            // Por enquanto, se a tabela 'turma' tem professor_id, podemos filtrar por lá ou buscar todos da escola.
            // Para seguir a solicitação de "da turma", vamos assumir que queremos filtrar.
            // Se não houver coluna turma_id em usuarios, precisaremos de uma tabela intermediária ou usar o id da turma.
        }

        return from(query.order('nome_completo', { ascending: true })).pipe(
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

    deleteProfessor(id: string): Observable<void> {
        return from(
            supabase
                .from('usuarios')
                .update({ deleted: true, status: 'inactive', excluido: 'sim' })
                .eq('id', id)
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return;
            })
        );
    }

    // --- STUDENT METHODS ---

    getStudentsBySchool(schoolId: string, turmaId?: string): Observable<any[]> {
        let query = supabase
            .from('aluno')
            .select('*, numeroCarteira:ra, turma:turma_id(nome, serie), user:usuario_id(id, email, ultimo_login)')
            .eq('escola_id', schoolId);

        if (turmaId) {
            query = query.eq('turma_id', turmaId);
        }

        return from(query.order('nome', { ascending: true })).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return resp.data || [];
            })
        );
    }

    async createStudent(data: any): Promise<{ success: boolean; error?: any }> {
        try {
            const email = data.emailAluno || data.email;
            const ra = data.numeroCarteira || data.ra;

            // 1. Manual Upsert into usuarios table
            let userId: any;
            const { data: existingUser } = await supabase
                .from('usuarios')
                .select('id')
                .eq('email', email)
                .single();

            const userPayload = {
                nome_completo: data.nome,
                nome: data.nome,
                email: email,
                tipo_acesso: 'Aluno',
                status: data.status || 'active',
                escola_id: data.escola_id,
                turmaID: data.turmaId,
                nome_mae: data.responsavel || data.nome_mae,
                ra: ra
            };

            if (existingUser) {
                const { error: updateError } = await supabase
                    .from('usuarios')
                    .update(userPayload)
                    .eq('id', existingUser.id);
                if (updateError) throw updateError;
                userId = existingUser.id;
            } else {
                const { data: newUser, error: insertError } = await supabase
                    .from('usuarios')
                    .insert(userPayload)
                    .select('id')
                    .single();
                if (insertError) throw insertError;
                userId = newUser.id;
            }

            // 2. Manual Upsert into aluno table
            const { data: existingAluno } = await supabase
                .from('aluno')
                .select('id')
                .eq('email', email)
                .single();

            const alunoPayload = {
                usuario_id: userId,
                escola_id: data.escola_id,
                turma_id: data.turmaId,
                nome: data.nome,
                nome_completo: data.nome,
                nome_mae: data.responsavel || data.nome_mae,
                email: email,
                ra: ra,
                data_nascimento: data.data_nascimento,
                primeiro_acesso: false
            };

            if (existingAluno) {
                const { error: alunoError } = await supabase
                    .from('aluno')
                    .update(alunoPayload)
                    .eq('id', existingAluno.id);
                if (alunoError) throw alunoError;
            } else {
                const { error: alunoError } = await supabase
                    .from('aluno')
                    .insert(alunoPayload);
                if (alunoError) throw alunoError;
            }

            // 3. Manual Upsert into carteira table
            if (ra) {
                const { data: existingCarteira } = await supabase
                    .from('carteira')
                    .select('id')
                    .eq('carteira_code', ra)
                    .single();

                const carteiraPayload = {
                    Usuario: userId,
                    carteira_code: ra,
                    turmaID: data.turmaId,
                    escola_id: data.escola_id
                };

                if (existingCarteira) {
                    await supabase
                        .from('carteira')
                        .update(carteiraPayload)
                        .eq('id', existingCarteira.id);
                } else {
                    await supabase
                        .from('carteira')
                        .insert(carteiraPayload);
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Create student failed:', error);
            return { success: false, error };
        }
    }

    async createStudentsBulk(schoolId: string, students: any[]): Promise<{ success: boolean; error?: any }> {
        try {
            for (const s of students) {
                await this.createStudent({ ...s, escola_id: schoolId });
            }
            return { success: true };
        } catch (error) {
            console.error('Bulk insert failed:', error);
            return { success: false, error };
        }
    }

    async updateStudent(id: string, data: any): Promise<{ success: boolean; error?: any }> {
        try {
            const email = data.emailAluno || data.email;
            const ra = data.numeroCarteira || data.ra;

            // 1. Get current student and linked user
            const { data: student, error: getError } = await supabase
                .from('aluno')
                .select('usuario_id')
                .eq('id', id)
                .single();
            
            if (getError) throw getError;

            // 2. Update user if exists
            if (student.usuario_id) {
                await supabase
                    .from('usuarios')
                    .update({
                        nome_completo: data.nome,
                        nome: data.nome,
                        email: email,
                        status: data.status,
                        turmaID: data.turmaId,
                        nome_mae: data.responsavel || data.nome_mae,
                        ra: ra
                    })
                    .eq('id', student.usuario_id);
            }

            // 3. Update student
            const { error: alunoError } = await supabase
                .from('aluno')
                .update({
                    turma_id: data.turmaId,
                    nome: data.nome,
                    nome_completo: data.nome,
                    nome_mae: data.responsavel || data.nome_mae,
                    email: email,
                    ra: ra,
                    data_nascimento: data.data_nascimento
                })
                .eq('id', id);

            if (alunoError) throw alunoError;

            // 4. Update or Create carteira
            if (ra && student.usuario_id) {
                const { data: existingCarteira } = await supabase
                    .from('carteira')
                    .select('id')
                    .eq('carteira_code', ra)
                    .single();

                const carteiraPayload = {
                    Usuario: student.usuario_id,
                    carteira_code: ra,
                    turmaID: data.turmaId,
                    escola_id: data.escola_id
                };

                if (existingCarteira) {
                    await supabase
                        .from('carteira')
                        .update(carteiraPayload)
                        .eq('id', existingCarteira.id);
                } else {
                    await supabase
                        .from('carteira')
                        .insert(carteiraPayload);
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Update student failed:', error);
            return { success: false, error };
        }
    }

    deleteStudent(id: string): Observable<any> {
        return from(
            supabase
                .from('aluno')
                .delete()
                .eq('id', id)
        );
    }
}
