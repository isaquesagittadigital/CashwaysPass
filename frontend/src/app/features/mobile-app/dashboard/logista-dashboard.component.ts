import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { LucideAngularModule, User, DollarSign, RefreshCw, Clock, LogOut, Coins, CircleDollarSign } from 'lucide-angular';
import { LojistaService, LojistaStats } from '../../../core/services/lojista.service';

@Component({
  selector: 'app-logista-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterModule],
  templateUrl: './logista-dashboard.component.html',
  styleUrls: ['./logista-dashboard.component.css']
})
export class LogistaDashboardComponent implements OnInit {
  userName = 'Cantina Caritas';
  userRole = 'Lojista';
  stats: LojistaStats = { total_vendas: 0, total_devolucao: 0 };
  
  icons = {
    User,
    DollarSign,
    RefreshCw,
    Clock,
    LogOut,
    Coins,
    CircleDollarSign
  };

  constructor(
    private router: Router,
    private lojistaService: LojistaService
  ) {}

  ngOnInit() {
    this.loadUserData();
    this.loadStats();
  }

  private loadUserData() {
    const userJson = sessionStorage.getItem('currentUser');
    if (userJson) {
      const user = JSON.parse(userJson);
      this.userName = user.nome_completo || user.nome || 'Lojista';
      this.userRole = user.tipo_acesso || 'Lojista';
    }
  }

  private async loadStats() {
    const userJson = sessionStorage.getItem('currentUser');
    if (userJson) {
      const user = JSON.parse(userJson);
      const userID = user.id;
      if (userID) {
        this.stats = await this.lojistaService.getStats(userID);
      }
    }
  }

  logout() {
    sessionStorage.clear();
    this.router.navigate(['/app/login']);
  }
}


