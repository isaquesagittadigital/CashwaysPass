import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, X, Save, ChevronDown } from 'lucide-angular';
import { SchoolManagementService } from '../../../../core/services/school-management.service';
import { NgxMaskDirective } from 'ngx-mask';

@Component({
    selector: 'app-edit-school-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgxMaskDirective],
    templateUrl: './edit-school-modal.component.html',
    styleUrls: ['./edit-school-modal.component.css']
})
export class EditSchoolModalComponent implements OnChanges {
    icons = { X, Save, ChevronDown };

    @Input() isVisible = false;
    @Input() schoolData: any = null;

    @Output() onClose = new EventEmitter<void>();
    @Output() onSuccess = new EventEmitter<void>();

    schoolForm: FormGroup;
    isSubmitting = false;

    constructor(
        private fb: FormBuilder,
        private schoolService: SchoolManagementService
    ) {
        this.schoolForm = this.fb.group({
            nome_fantasia: ['', Validators.required],
            cnpj: ['', Validators.required],
            razao_social: ['', Validators.required],
            modelo_contratacao: ['Full', Validators.required],
            dias_repasse: [3],
            possui_equipamentos: [true],
            quantidade_equipamentos: [0],
            valor_unitario_equipamento: [0],
            cobra_transacoes: [true],
            valor_unitario_transacao: [0],
            tipo_escola: ['', Validators.required],
            responsavel_direcao: ['', Validators.required],
            nome_secretariado: ['', Validators.required],
            email_contato: ['', [Validators.required, Validators.email]],
            email_secretaria_admin: ['', [Validators.required, Validators.email]],
            telefone_contato: [''],
            whatsapp: [''],
            cep: ['', Validators.required],
            complemento: [''],
            endereco: ['', Validators.required],
            valor_carteira: [0],
            valor_transferencia: [0],
            status: ['active', Validators.required]
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isVisible'] && this.isVisible && this.schoolData) {
            // Reset and patch values when opening the modal
            this.schoolForm.reset({
                ...this.schoolData,
                // Ensure default values for fields that might be missing
                dias_repasse: this.schoolData.dias_repasse || 3,
                possui_equipamentos: this.schoolData.possui_equipamentos ?? true,
                cobra_transacoes: this.schoolData.cobra_transacoes ?? true,
                valor_carteira: this.schoolData.valor_carteira || 0,
                valor_transferencia: this.schoolData.valor_transferencia || 0
            });
        }
    }

    onSubmit() {
        console.log('Form valid:', this.schoolForm.valid);
        if (!this.schoolForm.valid) {
            console.log('Form errors:', this.schoolForm.errors);
            // Log individual control errors
            Object.keys(this.schoolForm.controls).forEach(key => {
                const controlErrors = this.schoolForm.get(key)?.errors;
                if (controlErrors != null) {
                    console.log('Key: ' + key + ', Errors: ', controlErrors);
                }
            });
        }

        if (this.schoolForm.valid && this.schoolData?.id) {
            this.isSubmitting = true;
            this.schoolService.updateSchool(this.schoolData.id, this.schoolForm.value).subscribe({
                next: () => {
                    this.isSubmitting = false;
                    this.onSuccess.emit();
                },
                error: (err) => {
                    this.isSubmitting = false;
                    alert('Erro ao atualizar escola: ' + err.message);
                }
            });
        } else {
            this.schoolForm.markAllAsTouched();
        }
    }
}
// Forçando re-compilação para o Angular reconhecer o arquivo CSS do modal
