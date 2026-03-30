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
    activeTab: 'dados' | 'contratacao' = 'dados';

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

        // Toggle quantidade input based on possui_equipamentos
        this.schoolForm.get('possui_equipamentos')?.valueChanges.subscribe(value => {
            this.handleEquipamentosState(value);
        });

        // Toggle transaction inputs based on cobra_transacoes
        this.schoolForm.get('cobra_transacoes')?.valueChanges.subscribe(value => {
            this.handleTransacoesState(value);
        });
    }

    private handleEquipamentosState(value: boolean) {
        const quantidadeControl = this.schoolForm.get('quantidade_equipamentos');
        if (value) {
            quantidadeControl?.enable();
        } else {
            quantidadeControl?.disable();
            quantidadeControl?.setValue(0);
        }
    }

    private handleTransacoesState(value: boolean) {
        const unitario = this.schoolForm.get('valor_unitario_transacao');
        const carteira = this.schoolForm.get('valor_carteira');
        const transferencia = this.schoolForm.get('valor_transferencia');
        
        if (value) {
            unitario?.enable();
            carteira?.enable();
            transferencia?.enable();
        } else {
            unitario?.disable();
            unitario?.setValue(0);
            
            carteira?.disable();
            carteira?.setValue(0);
            
            transferencia?.disable();
            transferencia?.setValue(0);
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isVisible'] && this.isVisible && this.schoolData) {
            // Reset state then patch
            this.schoolForm.patchValue({
                ...this.schoolData,
                dias_repasse: this.schoolData.dias_repasse ?? 3,
                possui_equipamentos: this.schoolData.possui_equipamentos ?? true,
                cobra_transacoes: this.schoolData.cobra_transacoes ?? true,
                valor_carteira: this.schoolData.valor_carteira ?? 0,
                valor_transferencia: this.schoolData.valor_transferencia ?? 0
            });
            this.handleEquipamentosState(this.schoolForm.get('possui_equipamentos')?.value);
            this.handleTransacoesState(this.schoolForm.get('cobra_transacoes')?.value);
        }
    }

    onSubmit() {
        if (this.schoolForm.valid && this.schoolData?.id) {
            this.isSubmitting = true;
            
            // Send form values directly
            const updatePayload = { ...this.schoolForm.value };

            this.schoolService.updateSchool(this.schoolData.id, updatePayload).subscribe({
                next: () => {
                    this.isSubmitting = false;
                    this.onSuccess.emit();
                },
                error: (err) => {
                    this.isSubmitting = false;
                    console.error('Update error:', err);
                    alert('Erro ao atualizar escola: ' + (err.message || JSON.stringify(err)));
                }
            });
        } else {
            this.schoolForm.markAllAsTouched();
        }
    }
}
// Forçando re-compilação para o Angular reconhecer o arquivo CSS do modal
