import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-delete-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center relative animate-in zoom-in duration-200">
        <!-- Close button -->
        <button (click)="onCancel.emit()"
          class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <!-- Icon -->
        <div class="flex justify-center mb-5">
          <ng-container *ngIf="isReactivation; else deleteIcon">
             <div class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
             </div>
          </ng-container>
          <ng-template #deleteIcon>
            <img src="assets/icons/IconExcluir.svg" alt="Excluir" class="w-12 h-12" />
          </ng-template>
        </div>

        <!-- Title -->
        <h3 class="text-lg font-bold text-gray-900 mb-1">
          {{ isReactivation ? 'Deseja reativar ' + entityArticle + ' ' + entityName + '?' : (actionType === 'inactivate' ? 'Deseja inativar ' + entityArticle + ' ' + entityName + '?' : 'Deseja realmente excluir ' + entityArticle + ' ' + entityName + '?') }}
        </h3>

        <!-- Subtitle -->
        <p class="text-sm text-gray-400 mb-8">
          {{ isReactivation ? 'Esta escola voltará a aparecer nos fluxos ativos.' : (actionType === 'inactivate' ? 'A escola será ocultada dos fluxos ativos, mas poderá ser reativada depois.' : 'A ação não poderá ser desfeita.') }}
        </p>

        <!-- Buttons (stacked vertically) -->
        <div class="flex flex-col gap-3">
          <button (click)="onConfirm.emit()" [disabled]="isLoading"
            [ngClass]="isReactivation ? 'bg-green-600 hover:bg-green-700' : 'bg-[#00609b] hover:bg-[#004a7a]'"
            class="w-full py-3.5 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <span *ngIf="isLoading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            {{ isLoading ? (isReactivation ? 'Reativando...' : (actionType === 'inactivate' ? 'Inativando...' : 'Excluindo...')) : (isReactivation ? 'Sim, reativar ' + entityName : (actionType === 'inactivate' ? 'Sim, inativar ' + entityName : 'Sim, excluir ' + entityName)) }}
          </button>
          <button (click)="onCancel.emit()"
            class="w-full py-3.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all">
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
  @Input() entityName = 'item';
  @Input() entityArticle = 'o';
  @Input() isVisible = false;
  @Input() isLoading = false;
  @Input() isReactivation = false;
  @Input() actionType: 'delete' | 'inactivate' | 'reactivate' = 'delete';

  @Output() onConfirm = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();
}

