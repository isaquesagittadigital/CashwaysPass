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
                path: 'schools',
                loadComponent: () => import('./features/admin/schools/schools-list.component').then(m => m.SchoolsListComponent)
            },
            {
                path: 'schools/:id',
                loadComponent: () => import('./features/admin/schools/school-details.component').then(m => m.SchoolDetailsComponent)
            },
            {
                path: 'escolas/cadastro',
                loadComponent: () => import('./features/admin/school-registration/school-registration.component').then(m => m.SchoolRegistrationComponent)
            },
            {
                path: 'wallet',
                loadComponent: () => import('./features/admin/wallet/wallet.component').then(m => m.WalletComponent)
            },
            {
                path: 'products',
                loadComponent: () => import('./features/admin/products/products.component').then(m => m.ProductsComponent)
            },
            {
                path: 'events',
                loadComponent: () => import('./features/admin/events/events.component').then(m => m.EventsComponent)
            },
            {
                path: 'users',
                loadComponent: () => import('./features/admin/users/user-management.component').then(m => m.UserManagementComponent)
            },
            {
                path: 'reports',
                loadComponent: () => import('./features/admin/reports/reports.component').then(m => m.ReportsComponent)
            },
            {
                path: 'profile',
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
                path: 'wallet',
                loadComponent: () => import('./features/escola/wallet/wallet.component').then(m => m.EscolaWalletComponent)
            },
            {
                path: 'products',
                loadComponent: () => import('./features/escola/products/products.component').then(m => m.EscolaProductsComponent)
            },
            {
                path: 'events',
                loadComponent: () => import('./features/escola/events/events.component').then(m => m.EscolaEventsComponent)
            },
            {
                path: 'profile',
                loadComponent: () => import('./features/escola/profile/perfil.component').then(m => m.EscolaPerfilComponent)
            },
        ]
    },

    // Fallback
    { path: '**', redirectTo: '' }
];
