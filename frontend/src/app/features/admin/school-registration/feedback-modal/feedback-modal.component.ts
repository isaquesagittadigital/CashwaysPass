import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
    selector: 'app-feedback-modal',
    standalone: true,
    imports: [CommonModule, LucideAngularModule],
    template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in duration-300">
        <div [class]="iconBg" class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <i-lucide [name]="icon" [class]="iconColor" class="w-10 h-10"></i-lucide>
        </div>
        
        <h2 class="text-2xl font-black text-gray-900 mb-2 font-primary">{{ title }}</h2>
        <p class="text-gray-500 mb-8">{{ message }}</p>
        
        <div class="flex flex-col gap-3">
          <button (click)="confirm.emit()" class="w-full py-4 bg-[#00609b] text-white rounded-2xl font-bold hover:bg-[#004a7a] transition-all shadow-lg active:scale-95">
            {{ confirmLabel }}
          </button>
          <button *ngIf="showCancel" (click)="cancel.emit()" class="w-full py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors">
            {{ cancelLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    :host { display: block; }
  `]
})
export class FeedbackModalComponent {
    @Input() type: 'success' | 'confirm' | 'error' = 'success';
    @Input() title = 'Sucesso!';
    @Input() message = 'Operação realizada com sucesso.';
    @Input() confirmLabel = 'Continuar';
    @Input() cancelLabel = 'Cancelar';
    @Input() showCancel = false;

    @Output() confirm = new EventEmitter<void>();
    @Output() cancel = new EventEmitter<void>();

    get icon(): string {
        switch (this.type) {
            case 'success': return 'check';
            case 'confirm': return 'help-circle';
            case 'error': return 'alert-circle';
            default: return 'check';
        }
    }

    get iconBg(): string {
        switch (this.type) {
            case 'success': return 'bg-green-100';
            case 'confirm': return 'bg-blue-100';
            case 'error': return 'bg-red-100';
            default: return 'bg-green-100';
        }
    }

    get iconColor(): string {
        switch (this.type) {
            case 'success': return 'text-green-600';
            case 'confirm': return 'text-blue-600';
            case 'error': return 'text-red-600';
            default: return 'text-green-600';
        }
    }
}
