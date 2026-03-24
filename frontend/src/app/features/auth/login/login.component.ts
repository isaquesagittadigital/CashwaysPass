import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, User, Key, Eye, EyeOff, AlertCircle, AlertTriangle, X } from 'lucide-angular';
import { LogoComponent } from '../../../components/logo/logo.component';
import { supabase } from '../../../core/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, LogoComponent, RouterModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  isLoading = false;
  submitted = false;
  errorMessage = '';
  appVersion: string = 'Carregando...';

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

  ngOnInit() {
    this.loadAppVersion();
  }

  async loadAppVersion() {
    try {
      const { data, error } = await supabase
        .from('versionamento')
        .select('version_string')
        .eq('id', 1)
        .single();

      if (data && !error) {
        this.appVersion = 'VERSÃO ' + data.version_string;
      } else {
        this.appVersion = 'VERSÃO INDISPONÍVEL';
      }
    } catch (e) {
      console.error('Erro ao buscar versão', e);
      this.appVersion = 'VERSÃO INDISPONÍVEL';
    }
  }

  // Método setRole removido

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

      const userType = data.tipo_acesso?.toLowerCase();

      let redirectPath = '';
      if (userType === 'admin' || userType === 'administrador') {
        redirectPath = '/admin';
      } else if (userType === 'escola') {
        redirectPath = '/escola';
      } else {
        this.errorMessage = 'Acesso negado. Este usuário não possui privilégios para acessar o painel web.';
        this.isLoading = false;
        return;
      }

      const userData = { ...data };
      if (this.rememberMe) {
        userData.sessionExpiration = new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
        localStorage.setItem('currentUser', JSON.stringify(userData));
        sessionStorage.removeItem('currentUser');
      } else {
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.removeItem('currentUser');
      }
      
      this.router.navigate([redirectPath]);
    } catch (err) {
      console.error('Login error:', err);
      this.errorMessage = 'Erro ao conectar ao servidor. Verifique sua conexão.';
    } finally {
      this.isLoading = false;
    }
  }
}
