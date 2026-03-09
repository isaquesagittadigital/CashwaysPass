import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, User, Key, Eye, EyeOff, AlertCircle, AlertTriangle, X } from 'lucide-angular';
import { LogoComponent } from '../../../components/logo/logo.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, LogoComponent, RouterModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  role: 'school' | 'admin' = 'admin';
  email = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  isLoading = false;
  submitted = false;
  errorMessage = '';

  icons = {
    User: User,
    Key: Key,
    Eye: Eye,
    EyeOff: EyeOff,
    AlertCircle: AlertCircle,
    AlertTriangle: AlertTriangle,
    X: X
  };

  constructor(private router: Router) { }

  setRole(newRole: 'school' | 'admin') {
    this.role = newRole;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  isEmailValid(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.email);
  }

  isPasswordValid(): boolean {
    return this.password.length >= 6;
  }

  isFormValid(): boolean {
    return this.isEmailValid() && this.isPasswordValid();
  }

  async onLogin(event: Event) {
    event.preventDefault();
    this.submitted = true;

    if (!this.isFormValid()) return;

    this.isLoading = true;

    try {
      this.errorMessage = '';

      const { supabase } = await import('../../../core/supabase');

      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', this.email.trim())
        .eq('senha', this.password)
        .single();

      if (error || !data) {
        this.errorMessage = 'E-mail ou senha incorretos.';
        this.isLoading = false;
        return;
      }

      const userType = data.tipo_acesso;

      if (this.role === 'admin') {
        if (userType !== 'Admin' && userType !== 'Administrador') {
          this.errorMessage = 'Acesso negado. Este usuário não possui privilégios de Administrador. Verifique os dados e tente novamente.';
          this.isLoading = false;
          return;
        }

        localStorage.setItem('currentUser', JSON.stringify(data));
        this.router.navigate(['/admin']);
      } else if (this.role === 'school') {
        if (userType !== 'Escola') {
          this.errorMessage = 'Acesso negado. Este usuário não possui privilégios de Escola.';
          this.isLoading = false;
          return;
        }

        localStorage.setItem('currentUser', JSON.stringify(data));
        this.router.navigate(['/escola']);
      }
    } catch (err) {
      console.error('Login error:', err);
      this.errorMessage = 'Erro ao conectar ao servidor. Verifique sua conexão.';
    } finally {
      this.isLoading = false;
    }
  }
}
