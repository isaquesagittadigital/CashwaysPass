import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
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
        { icon: LayoutDashboard, label: 'Dashboard', route: 'dashboard', active: false },
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

        // Update active route on init and on navigation
        this.updateActiveRoute(this.router.url);
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            this.updateActiveRoute(event.urlAfterRedirects);
        });
    }

    private updateActiveRoute(url: string) {
        this.menuItems.forEach(item => {
            item.active = url.includes(`/admin/${item.route}`);
            if (item.active) this.activeRoute = item.route;
        });
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
        this.router.navigate(['/admin', route]);
    }

    logout() {
        this.router.navigate(['/']);
    }
}
