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
    periodo: string;
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

            // 1. Insert School
            const { data: schoolResp, error: schoolError } = await supabase
                .from('escola')
                .insert({
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
                    valor_transferencia: school.valorTransferencia
                })
                .select('id')
                .single();

            if (schoolError) throw schoolError;
            const schoolId = schoolResp.id as string;

            // 2. Insert Professors
            const profs = this.professors.value;
            if (profs.length > 0) {
                // a. Insert into Professor table
                const professorTableInserts = profs.map(p => ({
                    nome: p.nome,
                    especialidade: p.escolaridade, // Used in professor table
                    escola_id: schoolId
                }));

                const { data: profsTableData, error: profsTableError } = await supabase
                    .from('professor')
                    .insert(professorTableInserts)
                    .select();

                if (profsTableError) throw profsTableError;

                // b. Insert into Usuarios table
                const professorUserInserts = profs.map(p => ({
                    nome_completo: p.nome,
                    nome: p.nome,
                    email: p.email,
                    tipo_acesso: 'Professor',
                    status: 'active',
                    escola_id: schoolId,
                    grau_escolaridade: p.escolaridade // Also store in usuarios for management page
                }));

                const { data: profsUserResp, error: profsUserError } = await supabase
                    .from('usuarios')
                    .insert(professorUserInserts)
                    .select();

                if (profsUserError) throw profsUserError;

                // Map local temp UUIDs to real DB user IDs (though not strictly needed currently for turmas as they use name)
                const profIdMap = new Map();
                profs.forEach((p, i) => {
                    if (p.id) profIdMap.set(p.id, profsUserResp[i].id);
                });

                // 3. Insert Classes
                const turmas = this.turmas.value;
                if (turmas.length > 0) {
                    const turmaInserts = turmas.map(t => ({
                        nome: t.nome,
                        estagio: t.estagio,
                        Periodos: t.periodo,
                        serie: t.serie,
                        professor: profs.find(p => p.id === t.professor_id)?.nome || '',
                        quantidade_alunos: t.quantidade_alunos,
                        data_inicio: t.data_inicio,
                        data_entrada: t.data_inicio,
                        escola_id: schoolId,
                        status: true
                    }));

                    const { data: turmasResp, error: turmasError } = await supabase
                        .from('turma')
                        .insert(turmaInserts)
                        .select();

                    if (turmasError) throw turmasError;

                    // Map local temp UUIDs to real DB IDs
                    const turmaIdMap = new Map();
                    turmas.forEach((t, i) => {
                        if (t.id) turmaIdMap.set(t.id, turmasResp[i].id);
                    });

                    // 4. Insert Students
                    const students = this.students.value;
                    if (students.length > 0) {
                        const studentUserInserts = students.map(s => ({
                            nome_completo: s.nome,
                            nome: s.nome,
                            email: s.emailAluno, // Ensure student logs in with their own email
                            tipo_acesso: 'Aluno',
                            status: 'active',
                            escola_id: schoolId,
                            turmaID: turmaIdMap.get(s.turmaId),
                            nome_mae: s.responsavel,
                            ra: s.numeroCarteira
                        }));

                        const { data: studentsUserResp, error: studentsUserError } = await supabase
                            .from('usuarios')
                            .insert(studentUserInserts)
                            .select();

                        if (studentsUserError) throw studentsUserError;

                        const alunoInserts = students.map((s, i) => ({
                            usuario_id: studentsUserResp[i].id,
                            escola_id: schoolId,
                            turma_id: turmaIdMap.get(s.turmaId),
                            nome: s.nome,
                            email: s.emailAluno,
                            email_responsavel: s.emailResponsavel,
                            nome_mae: s.responsavel,
                            ra: s.numeroCarteira
                        }));

                        const { error: alunoError } = await supabase
                            .from('aluno')
                            .insert(alunoInserts);

                        if (alunoError) throw alunoError;

                        // 5. Insert Wallet (Carteira)
                        const carteiraInserts = students.map((s, i) => ({
                            Usuario: studentsUserResp[i].id, // BigInt
                            carteira_code: s.numeroCarteira,
                            turmaID: turmaIdMap.get(s.turmaId),
                            escola_id: schoolId
                        }));

                        const { error: carteiraError } = await supabase
                            .from('Carteira')
                            .insert(carteiraInserts);

                        if (carteiraError) throw carteiraError;
                    }
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Registration failed:', error);
            return { success: false, error };
        }
    }
}
