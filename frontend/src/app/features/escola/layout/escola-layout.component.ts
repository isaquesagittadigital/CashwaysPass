import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import {
    LucideAngularModule,
    LayoutDashboard,
    Users,
    GraduationCap,
    Settings,
    LogOut,
    Bell,
    Search,
    Menu,
    X,
    ShoppingBag,
    CalendarDays,
    BarChart3,
    Wallet,
    Store
} from 'lucide-angular';
import { LogoComponent } from '../../../components/logo/logo.component';

@Component({
    selector: 'app-escola-layout',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, LogoComponent, RouterModule, RouterOutlet],
    templateUrl: './escola-layout.component.html',
})
export class EscolaLayoutComponent {
    sidebarOpen = true;
    activeRoute = 'dashboard';

    icons = {
        LayoutDashboard, Users, GraduationCap, Settings, LogOut, Bell, Search,
        Menu, X, ShoppingBag, CalendarDays, BarChart3, Wallet, Store
    };

    menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', route: 'dashboard', active: true },
        { icon: Users, label: 'Cadastro', route: 'cadastro', active: false },
        { icon: Wallet, label: 'Carteira', route: 'wallet', active: false },
        { icon: ShoppingBag, label: 'Produtos', route: 'products', active: false },
        { icon: CalendarDays, label: 'Eventos', route: 'events', active: false },
        { icon: Settings, label: 'Perfil', route: 'profile', active: false },
    ];

    constructor(private router: Router) { }

    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
    }

    setActive(route: string) {
        this.activeRoute = route;
        this.menuItems.forEach(item => item.active = item.route === route);
    }

    logout() {
        this.router.navigate(['/']);
    }
}
