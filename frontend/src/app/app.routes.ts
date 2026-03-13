import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { AdminLayoutComponent } from './features/admin/layout/admin-layout.component';
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';
import { EscolaLayoutComponent } from './features/escola/layout/escola-layout.component';
import { EscolaDashboardComponent } from './features/escola/dashboard/escola-dashboard.component';
import { EscolaProductsComponent } from './features/escola/products/escola-products.component';
import { EscolaWalletComponent } from './features/escola/wallet/escola-wallet.component';
import { EscolaEventsComponent } from './features/escola/events/escola-events.component';
import { EscolaUserManagementComponent } from './features/escola/users/escola-user-management.component';
import { EscolaReportsComponent } from './features/escola/reports/escola-reports.component';
import { EscolaPerfilComponent } from './features/escola/profile/escola-perfil.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    // Login - página inicial
    { path: '', component: LoginComponent, title: 'Login | Cashways Pass' },
    { path: 'login', redirectTo: '', pathMatch: 'full' },

    // Admin panel
    {
        path: 'admin',
        component: AdminLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { 
                path: 'dashboard', 
                component: AdminDashboardComponent,
                title: 'Dashboard Admin | Cashways Pass'
            },
            {
                path: 'carteira', 
                loadComponent: () => import('./features/admin/wallet/wallet.component').then(m => m.WalletComponent),
                title: 'Gestão Financeira e Carteiras | Cashways Pass'
            },
            {
                path: 'produtos',
                loadComponent: () => import('./features/admin/products/products.component').then(m => m.ProductsComponent),
                title: 'Gestão de Produtos | Cashways Pass'
            },
            {
                path: 'eventos',
                loadComponent: () => import('./features/admin/events/events.component').then(m => m.EventsComponent),
                title: 'Gestão de Eventos | Cashways Pass'
            },
            {
                path: 'escolas',
                loadComponent: () => import('./features/admin/schools/schools-list.component').then(m => m.SchoolsListComponent),
                title: 'Escolas Parceiras | Cashways Pass'
            },
            {
                path: 'escolas/cadastro',
                loadComponent: () => import('./features/admin/school-registration/school-registration.component').then(m => m.SchoolRegistrationComponent),
                title: 'Cadastrar Nova Escola | Cashways Pass'
            },
            {
                path: 'escolas/:id',
                loadComponent: () => import('./features/admin/schools/school-details.component').then(m => m.SchoolDetailsComponent),
                title: 'Detalhes da Escola | Cashways Pass'
            },
            {
                path: 'usuarios',
                loadComponent: () => import('./features/admin/users/user-management.component').then(m => m.UserManagementComponent),
                title: 'Gestão de Usuários Administradores | Cashways Pass'
            },
            {
                path: 'relatorios',
                loadComponent: () => import('./features/admin/reports/reports.component').then(m => m.ReportsComponent),
                title: 'Relatórios do Sistema | Cashways Pass'
            },
            {
                path: 'perfil',
                loadComponent: () => import('./features/admin/profile/perfil.component').then(m => m.PerfilComponent),
                title: 'Meu Perfil | Cashways Pass'
            },
        ]
    },

    // Escola panel
    {
        path: 'escola',
        component: EscolaLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { 
                path: 'dashboard', 
                component: EscolaDashboardComponent,
                title: 'Dashboard Escola | Cashways Pass'
            },
            {
                path: 'carteira', 
                component: EscolaWalletComponent,
                title: 'Minha Carteira | Cashways Pass'
            },
            {
                path: 'produtos', 
                component: EscolaProductsComponent,
                title: 'Meus Produtos | Cashways Pass'
            },
            {
                path: 'eventos', 
                component: EscolaEventsComponent,
                title: 'Meus Eventos | Cashways Pass'
            },
            {
                path: 'escolas',
                loadComponent: () => import('./features/escola/schools/schools-list.component').then(m => m.SchoolsListComponent),
                title: 'Minhas Unidades | Cashways Pass'
            },
            {
                path: 'escolas/cadastro',
                loadComponent: () => import('./features/escola/school-registration/school-registration.component').then(m => m.SchoolRegistrationComponent),
                title: 'Cadastrar Unidade | Cashways Pass'
            },
            {
                path: 'escolas/:id',
                loadComponent: () => import('./features/escola/schools/school-details.component').then(m => m.SchoolDetailsComponent),
                title: 'Detalhes da Unidade | Cashways Pass'
            },
            {
                path: 'usuarios', 
                component: EscolaUserManagementComponent,
                title: 'Gestão de Usuários da Escola | Cashways Pass'
            },
            {
                path: 'relatorios', 
                component: EscolaReportsComponent,
                title: 'Relatórios Escolares | Cashways Pass'
            },
            {
                path: 'perfil', 
                component: EscolaPerfilComponent,
                title: 'Meu Perfil | Cashways Pass'
            },
        ]
    },

    // Fallback
    { path: '**', redirectTo: '' }
];
