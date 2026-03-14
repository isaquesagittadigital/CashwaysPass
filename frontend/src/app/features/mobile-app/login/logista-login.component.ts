import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, User, Key, Eye, EyeOff, AlertCircle, X, Frown } from 'lucide-angular';
import { LogoComponent } from '../../../components/logo/logo.component';
import { supabase } from '../../../core/supabase';

@Component({
  selector: 'app-app-login',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, LogoComponent, RouterModule, FormsModule],
  templateUrl: './logista-login.component.html',
  styleUrls: ['./logista-login.component.css']
})
export class AppLoginComponent implements OnInit {
  email = '';
  password = '';
  showPassword = false;
  isLoading = false;
  submitted = false;
  errorMessage = '';
  showErrorModal = false;

  icons = {
    User,
    Key,
    Eye,
    EyeOff,
    AlertCircle,
    X,
    Frown
  };

  constructor(private router: Router) { }

  ngOnInit() {
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

  async onLogin(event: Event) {
    event.preventDefault();
    this.submitted = true;

    if (!this.isEmailValid() || !this.isPasswordValid()) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', this.email.trim())
        .eq('senha', this.password)
        .single();

      if (error || !data) {
        this.showErrorModal = true;
        this.isLoading = false;
        return;
      }

      const userType = data.tipo_acesso?.toLowerCase();
      
      // Armazenar dados do usuário
      const userData = { ...data };
      sessionStorage.setItem('currentUser', JSON.stringify(userData));
      
      // Redirecionar para o dashboard do logista
      this.router.navigate(['/app/dashboard']);
      
    } catch (err) {
      console.error('Login error:', err);
      this.showErrorModal = true;
      this.errorMessage = 'Erro ao conectar ao servidor.';
    } finally {
      this.isLoading = false;
    }
  }

  onGoogleLogin() {
    console.log('Google login clicked');
    // Implementação futura do OAuth
  }

  closeErrorModal() {
    this.showErrorModal = false;
  }
}
