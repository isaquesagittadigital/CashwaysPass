import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
    LucideAngularModule,
    LayoutDashboard,
    Users,
    Building2,
    Settings,
    LogOut,
    Bell,
    Search,
    Menu,
    X,
    ChevronDown,
    FileText,
    CreditCard,
    BarChart3,
    Shield,
    CalendarDays,
    Wallet,
    Package,
    UserCircle
} from 'lucide-angular';
import { LogoComponent } from '../../../components/logo/logo.component';
import { SchoolService, School } from '../../../core/services/school.service';

@Component({
    selector: 'app-admin-layout',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, LogoComponent, RouterModule, RouterOutlet, FormsModule],
    templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
    sidebarOpen = true;
    activeRoute = 'dashboard';

    icons = {
        LayoutDashboard, Users, Building2, Settings, LogOut, Bell, Search,
        Menu, X, ChevronDown, FileText, CreditCard, BarChart3, Shield, CalendarDays,
        Wallet, Package, UserCircle
    };

    schools: School[] = [];
    selectedSchool: School | null = null;
    private searchSub?: Subscription;

    menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', route: 'dashboard', active: true },
        { icon: Building2, label: 'Escolas', route: 'escolas', active: false },
        { icon: Wallet, label: 'Carteira', route: 'carteira', active: false },
        { icon: Package, label: 'Produtos', route: 'produtos', active: false },
        { icon: CalendarDays, label: 'Eventos', route: 'eventos', active: false },
        { icon: Users, label: 'Usuários', route: 'usuarios', active: false },
        { icon: BarChart3, label: 'Relatórios', route: 'relatorios', active: false },
        { icon: UserCircle, label: 'Perfil', route: 'perfil', active: false },
    ];

    constructor(
        private router: Router,
        private schoolService: SchoolService
    ) { }

    ngOnInit() {
        this.schoolService.schools$.subscribe(s => this.schools = s);
        this.schoolService.selectedSchool$.subscribe(s => this.selectedSchool = s);
    }

    ngOnDestroy() {
        this.searchSub?.unsubscribe();
    }

    onSchoolChange(school: School) {
        if (school) {
            this.schoolService.selectSchool(school);
        }
    }

    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
    }

    setActive(route: string) {
        this.activeRoute = route;
        this.menuItems.forEach(item => item.active = item.route === route);
        this.router.navigate(['/admin', route]);
    }

    logout() {
        this.router.navigate(['/']);
    }
}
