import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, Trash2 } from 'lucide-angular';

@Component({
  selector: 'app-delete-confirm-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div *ngIf="isVisible" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 relative animate-in zoom-in-95 duration-200">
        
        <!-- Close button -->
        <button (click)="onCancel.emit()"
          class="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
          <lucide-icon [img]="icons.X" class="w-5 h-5"></lucide-icon>
        </button>

        <!-- Icon (Gradient Circle) -->
        <div class="mb-6 flex justify-start">
            <div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center shadow-sm border border-red-100">
              <lucide-icon [img]="icons.Trash2" class="w-7 h-7 text-red-500"></lucide-icon>
            </div>
        </div>

        <!-- Title -->
        <h3 class="text-xl font-bold text-gray-900 mb-2 leading-tight">
          {{ title || (isReactivation ? 'Deseja reativar ' + entityArticle + ' ' + entityName + '?' : (actionType === 'inactivate' ? 'Deseja inativar ' + entityArticle + ' ' + entityName + '?' : 'Deseja realmente excluir ' + entityArticle + ' ' + entityName + '?')) }}
        </h3>

        <!-- Subtitle -->
        <p class="text-[15px] text-gray-500 mb-8 leading-relaxed">
          {{ subtitle || (isReactivation ? 'Este registro voltará a aparecer nos fluxos ativos.' : (actionType === 'inactivate' ? 'O registro será ocultado dos fluxos ativos, mas poderá ser reativado depois.' : 'A ação não poderá ser desfeita.')) }}
        </p>

        <!-- Buttons -->
        <div class="flex flex-col gap-3">
          <button (click)="onConfirm.emit()" [disabled]="isLoading"
            class="w-full py-4 bg-[#00609b] text-white rounded-xl text-[15px] font-bold hover:bg-[#004d7c] transition-all shadow-md shadow-blue-900/10 disabled:opacity-50 flex items-center justify-center gap-2">
            <div *ngIf="isLoading" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            {{ isLoading ? 'Processando...' : (confirmText || (isReactivation ? 'Sim, reativar ' + entityName : (actionType === 'inactivate' ? 'Sim, inativar ' + entityName : 'Sim, excluir ' + entityName))) }}
          </button>
          
          <button (click)="onCancel.emit()"
            class="w-full py-4 bg-white border border-gray-200 rounded-xl text-[15px] font-bold text-gray-700 hover:bg-gray-50 transition-all">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class DeleteConfirmModalComponent {
  icons = { X, Trash2 };
  @Input() entityName = 'item';
  @Input() entityArticle = 'o';
  @Input() isVisible = false;
  @Input() isLoading = false;
  @Input() isReactivation = false;
  @Input() actionType: 'delete' | 'inactivate' | 'reactivate' = 'delete';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() confirmText = '';

  @Output() onConfirm = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();
}
