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
    { path: '', component: LoginComponent },
    { path: 'login', redirectTo: '', pathMatch: 'full' },

    // Admin panel
    {
        path: 'admin',
        component: AdminLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: AdminDashboardComponent },
            {
                path: 'carteira', loadComponent: () => import('./features/admin/wallet/wallet.component').then(m => m.WalletComponent)
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

    // Escola panel
    {
        path: 'escola',
        component: EscolaLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: EscolaDashboardComponent },
            {
                path: 'carteira', component: EscolaWalletComponent
            },
            {
                path: 'produtos', component: EscolaProductsComponent
            },
            {
                path: 'eventos', component: EscolaEventsComponent
            },
            {
                path: 'escolas',
                loadComponent: () => import('./features/escola/schools/schools-list.component').then(m => m.SchoolsListComponent)
            },
            {
                path: 'escolas/cadastro',
                loadComponent: () => import('./features/escola/school-registration/school-registration.component').then(m => m.SchoolRegistrationComponent)
            },
            {
                path: 'escolas/:id',
                loadComponent: () => import('./features/escola/schools/school-details.component').then(m => m.SchoolDetailsComponent)
            },
            {
                path: 'usuarios', component: EscolaUserManagementComponent
            },
            {
                path: 'relatorios', component: EscolaReportsComponent
            },
            {
                path: 'perfil', component: EscolaPerfilComponent
            },
        ]
    },

    // Fallback
    { path: '**', redirectTo: '' }
];
