import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SchoolManagementService, School } from '../../../core/services/school-management.service';
import { LucideAngularModule, ArrowLeft, Save } from 'lucide-angular';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FeedbackModalComponent } from '../school-registration/feedback-modal/feedback-modal.component';
import { TurmaManagementComponent } from './turma-management/turma-management.component';
import { ProfessorManagementComponent } from './professor-management/professor-management.component';
import { StudentManagementComponent } from './student-management/student-management.component';

@Component({
    selector: 'app-school-details',
    standalone: true,
    imports: [
        CommonModule,
        LucideAngularModule,
        ReactiveFormsModule,
        FeedbackModalComponent,
        TurmaManagementComponent,
        ProfessorManagementComponent,
        StudentManagementComponent
    ],
    templateUrl: './school-details.component.html',
    styleUrls: ['./school-details.component.css']
})
export class SchoolDetailsComponent implements OnInit {
    icons = { ArrowLeft, Save };
    schoolId: string | null = null;
    school: School | null = null;
    isLoading = true;
    activeTab: 'details' | 'turmas' | 'professors' | 'students' = 'details';

    schoolForm: FormGroup;
    showSuccessModal = false;

    seriesOptions = [
        { label: 'Fundamental 1', value: 'Fundamental 1' },
        { label: 'Fundamental 2', value: 'Fundamental 2' },
        { label: 'Ensino Médio', value: 'Ensino Médio' }
    ];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private schoolService: SchoolManagementService,
        private fb: FormBuilder
    ) {
        this.schoolForm = this.fb.group({
            nome_fantasia: ['', Validators.required],
            cnpj: ['', Validators.required],
            razao_social: ['', Validators.required],
            modelo_contratacao: ['Full', Validators.required],
            dias_repasse: [3, Validators.required],
            possui_equipamentos: [true, Validators.required],
            quantidade_equipamentos: [0],
            valor_unitario_equipamento: [0],
            cobra_transacoes: [true, Validators.required],
            valor_unitario_transacao: [0],
            tipo_escola: ['', Validators.required],
            responsavel_direcao: ['', Validators.required],
            nome_secretariado: ['', Validators.required],
            email_contato: ['', [Validators.required, Validators.email]],
            email_secretaria_admin: ['', [Validators.required, Validators.email]],
            telefone_contato: ['', Validators.required],
            whatsapp: ['', Validators.required],
            cep: ['', Validators.required],
            complemento: [''],
            endereco: ['', Validators.required],
            valor_carteira: [0, Validators.required],
            valor_transferencia: [0, Validators.required],
            status: ['active', Validators.required]
        });
    }

    ngOnInit(): void {
        this.schoolId = this.route.snapshot.paramMap.get('id');
        if (this.schoolId) {
            this.loadSchool();
        }
    }

    loadSchool() {
        this.isLoading = true;
        this.schoolService.getSchoolById(this.schoolId!).subscribe({
            next: (data) => {
                this.school = data;
                this.schoolForm.patchValue(data);
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading school:', err);
                this.isLoading = false;
            }
        });
    }

    onSubmit() {
        if (this.schoolForm.valid) {
            this.schoolService.updateSchool(this.schoolId!, this.schoolForm.value).subscribe({
                next: () => {
                    this.showSuccessModal = true;
                    this.loadSchool();
                },
                error: (err) => alert('Erro ao salvar: ' + err.message)
            });
        }
    }

    onBack() {
        this.router.navigate(['/admin/escolas']);
    }
}
