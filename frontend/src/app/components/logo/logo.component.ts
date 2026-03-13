import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logo.component.html',
})
export class LogoComponent {
  @Input() className: string = 'w-40';
  @Input() light: boolean = false;
  @Input() onlyMark: boolean = false;
}
