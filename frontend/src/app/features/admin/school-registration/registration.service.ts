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

    updateTurma(id: string, turma: TurmaData) {
        const current = this.turmas.value;
        const index = current.findIndex(t => t.id === id);
        if (index !== -1) {
            current[index] = { ...turma, id };
            this.turmas.next([...current]);
        }
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

            const payload = {
                school: {
                    ...school,
                    diasRepasse: Number(school.diasRepasse),
                    quantidadeEquipamentos: Number(school.quantidadeEquipamentos),
                    valorUnitarioEquipamento: Number(school.valorUnitarioEquipamento),
                    valorUnitarioTransacao: Number(school.valorUnitarioTransacao),
                    valorCarteira: Number(school.valorCarteira),
                    valorTransferencia: Number(school.valorTransferencia)
                },
                professors: this.professors.value,
                turmas: this.turmas.value,
                students: this.students.value
            };

            console.log('Submitting registration via RPC...', payload);

            const { data, error } = await supabase.rpc('register_complete_school', {
                registration_data: payload
            });

            if (error) {
                console.error('RPC Error:', error);
                throw error;
            }

            if (!data.success) {
                console.error('Registration logic error:', data.error);
                throw new Error(data.error || 'Erro interno no cadastro.');
            }

            console.log('Registration successful:', data);
            return { success: true };
        } catch (error: any) {
            console.error('Registration failed:', error);
            const errorMsg = error.message || error.error_description || 'Erro desconhecido durante o cadastro.';
            return { success: false, error: errorMsg };
        }
    }
}
