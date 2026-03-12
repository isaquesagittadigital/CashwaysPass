import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { supabase } from '../../../core/supabase';

export interface SchoolData {
    nome: string;
    cnpj: string;
    razaoSocial: string;
    modeloContratacao: 'Full' | 'Light';
    diasRepasse: number;
    possuiEquipamentos: boolean;
    quantidadeEquipamentos: number;
    valorUnitarioEquipamento: number;
    cobraTransacoes: boolean;
    valorUnitarioTransacao: number;
    serie: string;
    nomeDirecao: string;
    nomeSecretariado: string;
    emailEscola: string;
    emailSecretariaAdmin: string;
    telefone: string;
    whatsapp: string;
    cep: string;
    complemento: string;
    enderecoCompleto: string;
    valorCarteira: number;
    valorTransferencia: number;
}

export interface ProfessorData {
    id?: string;
    nome: string;
    escolaridade: string;
    email: string;
    status: 'active' | 'inactive';
}

export interface TurmaData {
    id?: string;
    nome: string;
    estagio: string;
    Periodos: string;
    serie: string;
    professor_id: string;
    quantidade_alunos: number;
    data_inicio: string;
    status: boolean;
}

export interface AlunoData {
    id?: string;
    turmaId: string;
    nome: string;
    responsavel: string;
    emailResponsavel: string;
    emailAluno: string;
    numeroCarteira: string;
}

@Injectable({
    providedIn: 'root'
})
export class SchoolRegistrationService {
    private currentStep = new BehaviorSubject<number>(1);
    currentStep$ = this.currentStep.asObservable();

    private schoolData = new BehaviorSubject<SchoolData | null>(null);
    schoolData$ = this.schoolData.asObservable();

    private isSchoolConfirmed = new BehaviorSubject<boolean>(false);
    isSchoolConfirmed$ = this.isSchoolConfirmed.asObservable();

    private professors = new BehaviorSubject<ProfessorData[]>([]);
    professors$ = this.professors.asObservable();

    private turmas = new BehaviorSubject<TurmaData[]>([]);
    turmas$ = this.turmas.asObservable();

    private students = new BehaviorSubject<AlunoData[]>([]);
    students$ = this.students.asObservable();

    constructor() { }

    setStep(step: number) {
        this.currentStep.next(step);
    }

    getCurrentStep(): number {
        return this.currentStep.value;
    }

    getCurrentStepConfirmed(): boolean {
        return this.isSchoolConfirmed.value;
    }

    updateSchoolData(data: SchoolData) {
        this.schoolData.next(data);
        this.isSchoolConfirmed.next(true);
    }

    addProfessor(professor: ProfessorData) {
        const current = this.professors.value;
        this.professors.next([...current, { ...professor, id: crypto.randomUUID() }]);
    }

    updateProfessor(id: string, professor: ProfessorData) {
        const current = this.professors.value;
        const index = current.findIndex(p => p.id === id);
        if (index !== -1) {
            current[index] = { ...professor, id };
            this.professors.next([...current]);
        }
    }

    removeProfessor(id: string) {
        const current = this.professors.value;
        this.professors.next(current.filter(p => p.id !== id));
    }

    addTurma(turma: TurmaData) {
        const current = this.turmas.value;
        this.turmas.next([...current, { ...turma, id: crypto.randomUUID() }]);
    }

    removeTurma(id: string) {
        const current = this.turmas.value;
        this.turmas.next(current.filter(t => t.id !== id));
    }

    addStudent(student: AlunoData) {
        const current = this.students.value;
        this.students.next([...current, { ...student, id: crypto.randomUUID() }]);
    }

    addStudentsBulk(students: AlunoData[]) {
        const current = this.students.value;
        const withIds = students.map(s => ({ ...s, id: crypto.randomUUID() }));
        this.students.next([...current, ...withIds]);
    }

    updateStudent(id: string, student: AlunoData) {
        const current = this.students.value;
        const index = current.findIndex(s => s.id === id);
        if (index !== -1) {
            current[index] = { ...student, id };
            this.students.next([...current]);
        }
    }

    removeStudent(id: string) {
        const current = this.students.value;
        this.students.next(current.filter(s => s.id !== id));
    }

    reset() {
        this.currentStep.next(1);
        this.schoolData.next(null);
        this.isSchoolConfirmed.next(false);
        this.professors.next([]);
        this.turmas.next([]);
        this.students.next([]);
    }

    async submitRegistration(): Promise<{ success: boolean; error?: any }> {
        try {
            const school = this.schoolData.value;
            if (!school) throw new Error('Dados da escola não encontrados.');

            // 1. Upsert School (prevents 409 if CNPJ already exists)
            const { data: schoolResp, error: schoolError } = await supabase
                .from('escola')
                .upsert({
                    nome_fantasia: school.nome,
                    cnpj: school.cnpj,
                    razao_social: school.razaoSocial,
                    modelo_contratacao: school.modeloContratacao,
                    dias_repasse: school.diasRepasse,
                    possui_equipamentos: school.possuiEquipamentos,
                    quantidade_equipamentos: school.quantidadeEquipamentos,
                    valor_unitario_equipamento: school.valorUnitarioEquipamento,
                    cobra_transacoes: school.cobraTransacoes,
                    valor_unitario_transacao: school.valorUnitarioTransacao,
                    tipo_escola: school.serie,
                    responsavel_direcao: school.nomeDirecao,
                    nome_secretariado: school.nomeSecretariado,
                    email_contato: school.emailEscola,
                    email_secretaria_admin: school.emailSecretariaAdmin,
                    telefone_contato: school.telefone,
                    whatsapp: school.whatsapp,
                    cep: school.cep,
                    complemento: school.complemento,
                    endereco: school.enderecoCompleto,
                    valor_carteira: school.valorCarteira,
                    valor_transferencia: school.valorTransferencia,
                    deletado: false
                }, { onConflict: 'cnpj' })
                .select('id')
                .single();

            if (schoolError) {
                console.error('Step 1: School upsert failed', schoolError);
                throw schoolError;
            }
            const schoolId = schoolResp.id as string;
            console.log('Step 1: School confirmed/upserted', schoolId);

            // 2. Insert Professors
            const profs = this.professors.value;
            if (profs.length > 0) {
                // a. Prepare and Upsert Professors (into 'professor' table)
                const professorTableInserts = profs.map(p => ({
                    nome: p.nome,
                    especialidade: p.escolaridade,
                    escola_id: schoolId
                }));

                const { data: profsTableData, error: profsTableError } = await supabase
                    .from('professor')
                    .upsert(professorTableInserts, { onConflict: 'id' }) // Use ID if known, but really we want to update by name
                    .select();

                // If upsert with ID fails or we need to be sure about name/escola_id matching:
                // We'll refetch or map by name later.

                if (profsTableError) {
                    console.error('Step 2a: Professor table upsert failed', profsTableError);
                    throw profsTableError;
                }
                console.log('Step 2a: Professors upserted', profsTableData);

                // b. Prepare and Upsert Users (into 'usuarios' table)
                for (const p of profs) {
                    const { data: existingUser } = await supabase
                        .from('usuarios')
                        .select('id')
                        .eq('email', p.email)
                        .single();

                    const userPayload = {
                        nome_completo: p.nome,
                        nome: p.nome,
                        email: p.email,
                        tipo_acesso: 'Professor',
                        status: 'active',
                        escola_id: schoolId,
                        grau_escolaridade: p.escolaridade
                    };

                    if (existingUser) {
                        const { error: updateError } = await supabase
                            .from('usuarios')
                            .update(userPayload)
                            .eq('id', existingUser.id);
                        if (updateError) throw updateError;
                    } else {
                        const { error: insertError } = await supabase
                            .from('usuarios')
                            .insert(userPayload);
                        if (insertError) throw insertError;
                    }
                }
                console.log('Step 2b: Professor users confirmed');

                // 3. Insert Classes
                const turmas = this.turmas.value;
                if (turmas.length > 0) {
                    const turmaIdMap = new Map();

                    for (const t of turmas) {
                        const { data: existingTurma } = await supabase
                            .from('turma')
                            .select('id')
                            .eq('nome', t.nome)
                            .eq('escola_id', schoolId)
                            .maybeSingle();

                        const turmaPayload = {
                            nome: t.nome,
                            estagio: t.estagio,
                            Periodos: t.Periodos,
                            serie: t.serie,
                            professor: profs.find(p => p.id === t.professor_id)?.nome || '',
                            quantidade_alunos: t.quantidade_alunos,
                            data_inicio: t.data_inicio,
                            data_entrada: t.data_inicio,
                            escola_id: schoolId,
                            status: true
                        };

                        if (existingTurma) {
                            const { error: updateError } = await supabase
                                .from('turma')
                                .update(turmaPayload)
                                .eq('id', existingTurma.id);
                            if (updateError) throw updateError;
                            turmaIdMap.set(t.id, existingTurma.id);
                        } else {
                            const { data: newTurma, error: insertError } = await supabase
                                .from('turma')
                                .insert(turmaPayload)
                                .select('id')
                                .single();
                            if (insertError) throw insertError;
                            turmaIdMap.set(t.id, newTurma.id);
                        }
                    }
                    console.log('Step 3: Turmas confirmed', Array.from(turmaIdMap.entries()));

                    // 4. Insert Students
                    const students = this.students.value;
                    if (students.length > 0) {
                        for (const s of students) {
                            // a. Upsert User (by email)
                            const { data: existingSUser } = await supabase
                                .from('usuarios')
                                .select('id')
                                .eq('email', s.emailAluno)
                                .single();

                            const studentUserPayload = {
                                nome_completo: s.nome,
                                nome: s.nome,
                                email: s.emailAluno,
                                tipo_acesso: 'Aluno',
                                status: 'active',
                                escola_id: schoolId,
                                turmaID: turmaIdMap.get(s.turmaId),
                                nome_mae: s.responsavel,
                                ra: s.numeroCarteira
                            };

                            let dbUserId;
                            if (existingSUser) {
                                const { error: uError } = await supabase
                                    .from('usuarios')
                                    .update(studentUserPayload)
                                    .eq('id', existingSUser.id);
                                if (uError) throw uError;
                                dbUserId = existingSUser.id;
                            } else {
                                const { data: nUser, error: iError } = await supabase
                                    .from('usuarios')
                                    .insert(studentUserPayload)
                                    .select('id')
                                    .single();
                                if (iError) throw iError;
                                dbUserId = nUser.id;
                            }

                            // b. Upsert Aluno (by email/nome/turma logic - manual check)
                            const { data: existingAluno } = await supabase
                                .from('aluno')
                                .select('id')
                                .eq('email', s.emailAluno)
                                .single();

                            const alunoPayload = {
                                usuario_id: dbUserId,
                                escola_id: schoolId,
                                turma_id: turmaIdMap.get(s.turmaId),
                                nome: s.nome,
                                email: s.emailAluno,
                                nome_mae: s.responsavel,
                                ra: s.numeroCarteira
                            };

                            if (existingAluno) {
                                const { error: aError } = await supabase
                                    .from('aluno')
                                    .update(alunoPayload)
                                    .eq('id', existingAluno.id);
                                if (aError) throw aError;
                            } else {
                                const { error: aError } = await supabase
                                    .from('aluno')
                                    .insert(alunoPayload);
                                if (aError) throw aError;
                            }

                            // c. Upsert Wallet (by code)
                            const { data: existingWallet } = await supabase
                                .from('carteira')
                                .select('id')
                                .eq('carteira_code', s.numeroCarteira)
                                .single();

                            const walletPayload = {
                                Usuario: dbUserId,
                                carteira_code: s.numeroCarteira,
                                turmaID: turmaIdMap.get(s.turmaId),
                                escola_id: schoolId
                            };

                            if (existingWallet) {
                                const { error: cError } = await supabase
                                    .from('carteira')
                                    .update(walletPayload)
                                    .eq('id', existingWallet.id);
                                if (cError) throw cError;
                            } else {
                                const { error: cError } = await supabase
                                    .from('carteira')
                                    .insert(walletPayload);
                                if (cError) throw cError;
                            }
                        }
                        console.log('Step 4/5: Students and Wallets confirmed');
                    }
                }
            }

            return { success: true };
        } catch (error: any) {
            console.error('Registration failed:', error);
            const errorMsg = error.message || error.error_description || 'Erro desconhecido durante o cadastro.';
            return { success: false, error: errorMsg };
        }
    }
}
