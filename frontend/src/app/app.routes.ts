import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { AdminLayoutComponent } from './features/admin/layout/admin-layout.component';
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';
import { EscolaLayoutComponent } from './features/escola/layout/escola-layout.component';
import { EscolaDashboardComponent } from './features/escola/dashboard/escola-dashboard.component';

export const routes: Routes = [
    // Login - página inicial
    { path: '', component: LoginComponent },
    { path: 'login', redirectTo: '', pathMatch: 'full' },

    // Admin panel
    {
        path: 'admin',
        component: AdminLayoutComponent,
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: AdminDashboardComponent },
            {
                path: 'escolas',
                loadComponent: () => import('./features/admin/schools/schools-list.component').then(m => m.SchoolsListComponent)
            },
            {
                path: 'escolas/cadastro',
                loadComponent: () => import('./features/admin/school-registration/school-registration.component').then(m => m.SchoolRegistrationComponent)
            },
            {
                path: 'escolas/:id',
                loadComponent: () => import('./features/admin/schools/school-details.component').then(m => m.SchoolDetailsComponent)
            },
            {
                path: 'carteira',
                loadComponent: () => import('./features/admin/wallet/wallet.component').then(m => m.WalletComponent)
            },
            {
                path: 'produtos',
                loadComponent: () => import('./features/admin/products/products.component').then(m => m.ProductsComponent)
            },
            {
                path: 'eventos',
                loadComponent: () => import('./features/admin/events/events.component').then(m => m.EventsComponent)
            },
            {
                path: 'usuarios',
                loadComponent: () => import('./features/admin/users/user-management.component').then(m => m.UserManagementComponent)
            },
            {
                path: 'relatorios',
                loadComponent: () => import('./features/admin/reports/reports.component').then(m => m.ReportsComponent)
            },
            {
                path: 'perfil',
                loadComponent: () => import('./features/admin/profile/perfil.component').then(m => m.PerfilComponent)
            },
        ]
    },

    // School panel
    {
        path: 'escola',
        component: EscolaLayoutComponent,
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: EscolaDashboardComponent },
            {
                path: 'cadastro',
                loadComponent: () => import('./features/escola/cadastro/cadastro.component').then(m => m.CadastroComponent)
            },
            {
                path: 'carteira',
                loadComponent: () => import('./features/escola/wallet/wallet.component').then(m => m.EscolaWalletComponent)
            },
            {
                path: 'produtos',
                loadComponent: () => import('./features/escola/products/products.component').then(m => m.EscolaProductsComponent)
            },
            {
                path: 'eventos',
                loadComponent: () => import('./features/escola/events/events.component').then(m => m.EscolaEventsComponent)
            },
            {
                path: 'perfil',
                loadComponent: () => import('./features/escola/profile/perfil.component').then(m => m.EscolaPerfilComponent)
            },
        ]
    },

    // Fallback
    { path: '**', redirectTo: '' }
];
