import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SystemUpdateToastComponent } from './shared/components/system-update-toast/system-update-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SystemUpdateToastComponent],
  template: `
    <router-outlet></router-outlet>
    <app-system-update-toast></app-system-update-toast>
  `,
  styles: [`:host { display: block; min-height: 100vh; }`]
})
export class AppComponent {
  title = 'Cashways Pass';
}
