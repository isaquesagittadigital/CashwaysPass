import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, CheckCircle } from 'lucide-angular';

@Component({
    selector: 'app-action-success-modal',
    standalone: true,
    imports: [CommonModule, LucideAngularModule],
    template: `
    <div *ngIf="isVisible" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div class="bg-white rounded-[24px] shadow-2xl w-full max-w-sm p-8 relative animate-in zoom-in-95 duration-200">
        
        <!-- Close button (Top Right) -->
        <button (click)="onClose.emit()"
          class="absolute top-5 right-5 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
          <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
        </button>

        <!-- Icon (Top Left/Center-ish) -->
        <div class="mb-5 flex justify-start">
           <div class="w-16 h-16 rounded-full bg-gradient-to-br from-[#00609b] to-[#0093e9] flex items-center justify-center shadow-lg shadow-blue-900/20">
              <lucide-icon name="check-circle" class="w-8 h-8 text-white"></lucide-icon>
           </div>
        </div>

        <!-- Title -->
        <h3 class="text-[20px] font-bold text-gray-900 mb-2 leading-tight">
          {{ title }}
        </h3>

        <!-- Subtitle -->
        <p class="text-[15px] text-gray-500 mb-8">
          {{ message }}
        </p>

        <!-- Action Button -->
        <button (click)="onClose.emit()"
          class="w-full py-3.5 bg-white border border-gray-300 rounded-xl text-[15px] font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
          Fechar
        </button>
      </div>
    </div>
  `,
    styles: [`:host { display: block; }`]
})
export class ActionSuccessModalComponent {
    icons = { X, CheckCircle };
    @Input() isVisible = false;
    @Input() title = 'Sucesso!';
    @Input() message = 'Ação concluída com sucesso!';

    @Output() onClose = new EventEmitter<void>();
}
