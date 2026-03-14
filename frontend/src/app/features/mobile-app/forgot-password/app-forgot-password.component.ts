import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Key, Mail, Lock, CheckCircle, ArrowLeft, Check } from 'lucide-angular';

type ResetStep = 'request' | 'sent' | 'new-password' | 'success';

@Component({
  selector: 'app-app-forgot-password',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterModule, FormsModule],
  templateUrl: './app-forgot-password.component.html',
  styleUrls: ['./app-forgot-password.component.css']
})
export class AppForgotPasswordComponent {
  currentStep: ResetStep = 'request';
  email = '';
  newPassword = '';
  confirmPassword = '';
  isLoading = false;

  icons = {
    Key,
    Mail,
    Lock,
    CheckCircle,
    ArrowLeft,
    Check
  };

  constructor(private router: Router) {}

  onRequestReset() {
    if (!this.email) return;
    this.isLoading = true;
    
    // Simulação de envio
    setTimeout(() => {
      this.isLoading = false;
      this.currentStep = 'sent';
    }, 1500);
  }

  onResetPassword() {
    if (this.newPassword !== this.confirmPassword || this.newPassword.length < 8) return;
    this.isLoading = true;

    // Simulação de alteração
    setTimeout(() => {
      this.isLoading = false;
      this.currentStep = 'success';
    }, 1500);
  }

  goToLogin() {
    this.router.navigate(['/app/login']);
  }

  resendEmail() {
    console.log('Resending email to:', this.email);
  }

  openEmailClient() {
    window.location.href = 'mailto:';
  }

  setStep(step: ResetStep) {
    this.currentStep = step;
  }
}
