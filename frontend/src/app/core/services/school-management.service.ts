import { Injectable } from '@angular/core';
import { supabase } from '../supabase';
import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { EmailService } from './email.service';

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
    constructor(private emailService: EmailService) { }

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
                .select('*, professor_obj:usuarios(id, nome_completo, tipo_acesso)')
                .eq('escola_id', schoolId)
                .order('nome', { ascending: true })
        ).pipe(
            map(resp => {
                if (resp.error) throw resp.error;
                return (resp.data || []).map(t => {
                    const prof = (t.professor_obj as any[])?.find(u => u.tipo_acesso === 'Professor');
                    return {
                        ...t,
                        professor_nome: prof ? prof.nome_completo : null
                    };
                });
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
            .or('deleted.is.null,deleted.eq.false')
            .neq('excluido', 'sim');

        if (turmaId) {
            console.log('Filtrando professores pela turma:', turmaId);
            query = query.eq('turmaID', turmaId);
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
                .select()
        );
    }

    updateProfessor(id: string, data: any): Observable<any> {
        return from(
            supabase
                .from('usuarios')
                .update(data)
                .eq('id', id)
                .select()
        );
    }

    deleteProfessor(id: string): Observable<void> {
        return from((async () => {
            // 1. Primeiro buscamos os dados do professor em usuarios para ter o nome e escola_id
            const { data: prof } = await supabase
                .from('usuarios')
                .select('nome_completo, escola_id')
                .eq('id', id)
                .single();

            if (prof) {
                // 2. Removemos da tabela professor (usando nome e escola como chave, já que IDs são diferentes)
                await supabase.from('professor')
                    .delete()
                    .eq('escola_id', prof.escola_id)
                    .eq('nome', prof.nome_completo);
            }

            // 3. Soft delete mandatório em usuarios para manter histórico/integridade
            const { error } = await supabase
                .from('usuarios')
                .update({ 
                    deleted: true, 
                    status: 'inactive', 
                    excluido: 'sim' 
                })
                .eq('id', id)
                .select();
            
            if (error) throw error;
        })()).pipe(
            map(() => { return; })
        );
    }

    // --- STUDENT METHODS ---

    getStudentsBySchool(schoolId: string, turmaId?: string): Observable<any[]> {
        let query = supabase
            .from('aluno')
            .select('*, numeroCarteira:ra, turma:turma_id(nome, serie), user:usuario_id(id, email, ultimo_login, telefone)')
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
            const ra = data.numeroCarteira || data.ra || data.ra_aluno;
            const tId = data.turmaId || data.turma_id || data.turmaID || null;

            // 1. Manual Upsert into usuarios table
            let userId: any;
            const { data: existingUser } = await supabase
                .from('usuarios')
                .select('id')
                .eq('email', email)
                .single();

            const tempPass = Math.random().toString(36).slice(-8);
            const userPayload = {
                nome_completo: data.nome,
                nome: data.nome,
                email: email,
                tipo_acesso: 'Aluno',
                status: data.status || 'active',
                escola_id: data.escola_id,
                turmaID: tId,
                nome_mae: data.responsavel || data.nome_mae,
                ra: ra,
                temp_pass: tempPass,
                senha: tempPass,
                primeiro_acesso: false
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
                turma_id: tId,
                nome: data.nome,
                nome_completo: data.nome,
                nome_mae: data.responsavel || data.nome_mae,
                email: email,
                ra: ra,
                data_nascimento: data.data_nascimento || null,
                primeiro_acesso: false,
                email_responsavel: data.email_responsavel || null
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

            // 5. Create Guardian Account if email provided
            if (data.email_responsavel) {
                const guardianEmail = data.email_responsavel;
                const { data: existingGuardian } = await supabase
                    .from('usuarios')
                    .select('id')
                    .eq('email', guardianEmail)
                    .single();

                if (!existingGuardian) {
                    const guardianPass = Math.random().toString(36).slice(-8);
                    const guardianPayload = {
                        nome_completo: (data.responsavel || data.nome_mae || 'Responsável'),
                        nome: (data.responsavel || data.nome_mae || 'Responsável'),
                        email: guardianEmail,
                        tipo_acesso: 'Responsavel',
                        status: 'active',
                        escola_id: data.escola_id,
                        temp_pass: guardianPass,
                        senha: guardianPass,
                        primeiro_acesso: false
                    };
                    
                    const { error: guardianError } = await supabase
                        .from('usuarios')
                        .insert(guardianPayload);
                    
                    if (!guardianError) {
                        this.emailService.sendAccessEmail(guardianEmail, guardianPass, guardianPayload.nome).subscribe();
                    }
                }
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
                    turmaID: tId,
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

            // 4. Send Access Email (The DB trigger should also catch this, but direct service call ensures delivery)
            this.emailService.sendAccessEmail(email, tempPass, data.nome).subscribe({
                next: (result) => console.log('Welcome email sent successfully:', result),
                error: (err) => console.error('Failed to send welcome email:', err)
            });

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
            const ra = data.numeroCarteira || data.ra || data.ra_aluno;
            const tId = data.turmaId || data.turma_id || data.turmaID || null;

            // 1. Get current student and linked user
            const { data: student, error: getError } = await supabase
                .from('aluno')
                .select('usuario_id, ra, email, email_responsavel')
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
                        turmaID: tId,
                        nome_mae: data.responsavel || data.nome_mae,
                        ra: ra,
                        primeiro_acesso: data.primeiro_acesso ?? false
                    })
                    .eq('id', student.usuario_id);
            }

            // 3. Update student
            const { error: alunoError } = await supabase
                .from('aluno')
                .update({
                    turma_id: tId,
                    nome: data.nome,
                    nome_completo: data.nome,
                    nome_mae: data.responsavel || data.nome_mae,
                    email: email,
                    ra: ra,
                    data_nascimento: data.data_nascimento || null,
                    email_responsavel: data.email_responsavel || null
                })
                .eq('id', id);

            if (alunoError) throw alunoError;

            // Guardian Account Handle
            if (data.email_responsavel && data.email_responsavel !== student.email_responsavel) {
                const guardianEmail = data.email_responsavel;
                const { data: existingGuardian } = await supabase
                    .from('usuarios')
                    .select('id')
                    .eq('email', guardianEmail)
                    .single();

                if (!existingGuardian) {
                    const guardianPass = Math.random().toString(36).slice(-8);
                    const guardianPayload = {
                        nome_completo: (data.responsavel || data.nome_mae || 'Responsável'),
                        nome: (data.responsavel || data.nome_mae || 'Responsável'),
                        email: guardianEmail,
                        tipo_acesso: 'Responsavel',
                        status: 'active',
                        escola_id: data.escola_id,
                        temp_pass: guardianPass,
                        senha: guardianPass,
                        primeiro_acesso: false
                    };
                    
                    const { error: guardianError } = await supabase
                        .from('usuarios')
                        .insert(guardianPayload);
                    
                    if (!guardianError) {
                        this.emailService.sendAccessEmail(guardianEmail, guardianPass, guardianPayload.nome).subscribe();
                    }
                }
            }

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
                    turmaID: tId,
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

    deleteStudent(id: string): Observable<void> {
        return from((async () => {
            // 1. Buscar o aluno para obter o usuario_id
            const { data: student, error: getError } = await supabase
                .from('aluno')
                .select('usuario_id, ra')
                .eq('id', id)
                .single();
            
            if (getError) throw getError;

            // 2. Se tiver ra/carteira, limpar da tabela carteira
            if (student.ra) {
                await supabase
                    .from('carteira')
                    .delete()
                    .eq('carteira_code', student.ra);
            }

            // 3. Deletar registro da tabela aluno
            const { error: alunoError } = await supabase
                .from('aluno')
                .delete()
                .eq('id', id);
            
            if (alunoError) throw alunoError;

            // 4. Se tiver usuario_id, fazer o soft delete em usuarios
            if (student.usuario_id) {
                const { error: userError } = await supabase
                    .from('usuarios')
                    .update({ 
                        deleted: true, 
                        status: 'inactive', 
                        excluido: 'sim' 
                    })
                    .eq('id', student.usuario_id);
                
                if (userError) throw userError;
            }
        })()).pipe(
            map(() => { return; })
        );
    }
}
