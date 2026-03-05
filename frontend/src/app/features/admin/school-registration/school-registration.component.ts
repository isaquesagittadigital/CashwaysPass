import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolRegistrationService } from './registration.service';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StepSchoolComponent } from './steps/step-school/step-school.component';
import { StepProfessorComponent } from './steps/step-professor/step-professor.component';
import { StepTurmaComponent } from './steps/step-turma/step-turma.component';
import { StepAlunoComponent } from './steps/step-aluno/step-aluno.component';

@Component({
    selector: 'app-school-registration',
    standalone: true,
    imports: [
        CommonModule,
        LucideAngularModule,
        StepSchoolComponent,
        StepProfessorComponent,
        StepTurmaComponent,
        StepAlunoComponent
    ],
    templateUrl: './school-registration.component.html',
    styleUrls: ['./school-registration.component.css']
})
export class SchoolRegistrationComponent implements OnInit, OnDestroy {
    currentStep$ = this.registrationService.currentStep$;
    isSchoolConfirmed$ = this.registrationService.isSchoolConfirmed$;
    icons = { ArrowLeft };
    private stepSub?: Subscription;

    steps = [
        { number: 1, label: 'Cadastrar escola' },
        { number: 2, label: 'Cadastrar professor' },
        { number: 3, label: 'Cadastrar turma' },
        { number: 4, label: 'Cadastrar alunos' }
    ];

    constructor(
        private registrationService: SchoolRegistrationService,
        private router: Router
    ) { }

    ngOnInit(): void {
        // Reset registration when entering
        this.registrationService.reset();

        // Scroll to top on every step change
        this.stepSub = this.currentStep$.subscribe(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    ngOnDestroy(): void {
        this.stepSub?.unsubscribe();
    }

    setStep(step: number) {
        if (step > 1 && !this.registrationService.getCurrentStepConfirmed()) {
            return;
        }
        this.registrationService.setStep(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    onBack() {
        this.router.navigate(['/admin/dashboard']);
    }

    get headerMessage(): string {
        const step = this.registrationService.getCurrentStep();
        switch (step) {
            case 1: return 'Como primeiro passo, vamos cadastrar a escola.';
            case 2: return 'Agora, vamos cadastrar os professores.';
            case 3: return 'Agora, vamos cadastrar as turmas.';
            case 4: return 'Por fim, vamos cadastrar os alunos.';
            default: return 'Preencha os dados abaixo.';
        }
    }
}
