import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SystemUpdateToastComponent } from './shared/components/system-update-toast/system-update-toast.component';
import { LoadingComponent } from './shared/components/loading/loading.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SystemUpdateToastComponent, LoadingComponent],
  template: `
    <router-outlet></router-outlet>
    <app-system-update-toast></app-system-update-toast>
    <app-loading></app-loading>
  `,
  styles: [`:host { display: block; min-height: 100vh; }`]
})
export class AppComponent {
  title = 'Cashways Pass';
}
