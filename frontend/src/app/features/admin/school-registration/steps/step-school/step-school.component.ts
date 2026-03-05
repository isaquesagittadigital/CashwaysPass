import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService } from '../../registration.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
    selector: 'app-step-school',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
    templateUrl: './step-school.component.html',
    styleUrls: ['./step-school.component.css']
})
export class StepSchoolComponent implements OnInit {
    schoolForm: FormGroup;

    seriesOptions = [
        { label: 'Fundamental 1', value: 'Fundamental 1' },
        { label: 'Fundamental 2', value: 'Fundamental 2' },
        { label: 'Ensino Médio', value: 'Ensino Médio' }
    ];

    constructor(
        private fb: FormBuilder,
        private registrationService: SchoolRegistrationService
    ) {
        this.schoolForm = this.fb.group({
            nome: ['', Validators.required],
            cnpj: ['', Validators.required],
            razaoSocial: ['', Validators.required],
            modeloContratacao: ['Full', Validators.required],
            diasRepasse: [3, Validators.required],
            possuiEquipamentos: [true, Validators.required],
            quantidadeEquipamentos: [0],
            valorUnitarioEquipamento: [0],
            cobraTransacoes: [true, Validators.required],
            valorUnitarioTransacao: [0],
            serie: ['', Validators.required],
            nomeDirecao: ['', Validators.required],
            nomeSecretariado: ['', Validators.required],
            emailEscola: ['', [Validators.required, Validators.email]],
            emailSecretariaAdmin: ['', [Validators.required, Validators.email]],
            telefone: ['', Validators.required],
            whatsapp: ['', Validators.required],
            cep: ['', Validators.required],
            complemento: [''],
            enderecoCompleto: ['', Validators.required],
            valorCarteira: [0, Validators.required],
            valorTransferencia: [0, Validators.required]
        });
    }

    ngOnInit(): void {
        // Fill if data exists (back navigation)
        this.registrationService.schoolData$.subscribe(data => {
            if (data) {
                this.schoolForm.patchValue(data);
            }
        });
    }

    onNext() {
        if (this.schoolForm.valid) {
            this.registrationService.updateSchoolData(this.schoolForm.value);
            this.registrationService.setStep(2);
        } else {
            // Mark all as touched to show errors
            this.schoolForm.markAllAsTouched();
        }
    }
}
