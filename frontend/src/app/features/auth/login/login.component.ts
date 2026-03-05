import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, User, Key, Eye, EyeOff } from 'lucide-angular';
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

  icons = {
    User: User,
    Key: Key,
    Eye: Eye,
    EyeOff: EyeOff,
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
      // Import the dynamic supabase client (avoiding circular or early initialization issues if any)
      const { supabase } = await import('../../../core/supabase');

      const { data, error } = await supabase
        .from('usuarios')
        .select('email, senha, tipo_acesso')
        .eq('email', this.email.trim())
        .eq('senha', this.password)
        .single();

      if (error || !data) {
        alert('E-mail ou senha incorretos.');
        this.isLoading = false;
        return;
      }

      // Verify if the role matches the selected tab
      const userRole = data.tipo_acesso.toLowerCase();
      const selectedRole = this.role === 'school' ? 'escola' : 'admin';

      if (userRole !== selectedRole) {
        alert(`Este usuário não tem permissão de ${this.role === 'admin' ? 'Administrador' : 'Escola'}.`);
        this.isLoading = false;
        return;
      }

      // Success - navigate to the appropriate dashboard
      if (this.role === 'admin') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/school']);
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Erro ao conectar ao servidor.');
    } finally {
      this.isLoading = false;
    }
  }
}
