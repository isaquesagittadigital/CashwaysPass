import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SchoolRegistrationService } from '../../registration.service';
import { LucideAngularModule } from 'lucide-angular';
import { Router } from '@angular/router';
import { NgxMaskDirective } from 'ngx-mask';

@Component({
    selector: 'app-step-school',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgxMaskDirective],
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
        private registrationService: SchoolRegistrationService,
        private router: Router
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
            this.schoolForm.markAllAsTouched();
        }
    }

    applyCnpjMask(event: any) {
        let val = event.target.value.replace(/\D/g, '');
        if (val.length > 14) val = val.substring(0, 14);

        let masked = val;
        if (val.length > 2) masked = val.substring(0, 2) + '.' + val.substring(2);
        if (val.length > 5) masked = masked.substring(0, 6) + '.' + masked.substring(6);
        if (val.length > 8) masked = masked.substring(0, 10) + '/' + masked.substring(10);
        if (val.length > 12) masked = masked.substring(0, 15) + '-' + masked.substring(15);

        this.schoolForm.get('cnpj')?.setValue(masked, { emitEvent: false });
    }

    applyPhoneMask(field: string, event: any) {
        let val = event.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.substring(0, 11);

        let masked = val;
        if (val.length > 0) masked = '(' + val;
        if (val.length > 2) masked = '(' + val.substring(0, 2) + ') ' + val.substring(2);
        if (val.length > 7) masked = masked.substring(0, 10) + '-' + masked.substring(10);

        this.schoolForm.get(field)?.setValue(masked, { emitEvent: false });
    }

    applyCepMask(event: any) {
        let val = event.target.value.replace(/\D/g, '');
        if (val.length > 8) val = val.substring(0, 8);

        let masked = val;
        if (val.length > 5) masked = val.substring(0, 5) + '-' + val.substring(5);

        this.schoolForm.get('cep')?.setValue(masked, { emitEvent: false });
    }

    onCurrencyKeydown(event: KeyboardEvent) {
        // Block minus sign and other non-numeric chars except navigation/delete
        if (event.key === '-' || event.key === 'e' || event.key === 'E' || event.key === '+') {
            event.preventDefault();
        }
    }

    applyCurrencyMask(field: string, event: any) {
        // Get only digits
        let val = event.target.value.replace(/\D/g, '');

        // Convert to number (handling decimals by dividing by 100)
        const amount = val ? parseInt(val) / 100 : 0;

        // Update form control
        this.schoolForm.get(field)?.setValue(amount, { emitEvent: false });

        // Explicitly update input value to match the formatted number if needed,
        // although keeping it as number type might be better for some browsers.
        // However, for better UX with the R$ prefix, we want to ensure no weird chars stay.
        event.target.value = amount.toFixed(2).replace('.', ',');
    }

    formatBrl(value: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    onCancel() {
        this.registrationService.reset();
        this.router.navigate(['/admin/dashboard']);
    }
}
