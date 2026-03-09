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
import { supabase } from '../../../core/supabase';

@Component({
    selector: 'app-admin-layout',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, LogoComponent, RouterModule, RouterOutlet, FormsModule],
    templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
    sidebarOpen = true;
    activeRoute = 'dashboard';
    appVersion: string = 'Carregando...';

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
        { icon: Wallet, label: 'Carteira', route: 'carteira', active: false },
        { icon: Package, label: 'Produtos', route: 'produtos', active: false },
        { icon: CalendarDays, label: 'Eventos', route: 'eventos', active: false },
        { icon: Building2, label: 'Escolas', route: 'escolas', active: false },
        { icon: Users, label: 'Usuários', route: 'usuarios', active: false },
        { icon: BarChart3, label: 'Relatórios', route: 'relatorios', active: false },
        { icon: UserCircle, label: 'Perfil', route: 'perfil', active: false },
    ];

    constructor(
        private router: Router,
        private schoolService: SchoolService
    ) {
        // Select first school by default if none selected
        this.schoolService.schools$.subscribe(schools => {
            this.schools = schools;
            if (schools.length > 0 && !this.selectedSchool) {
                this.onSchoolChange(schools[0]);
            }
        });

        this.loadAppVersion();
    }

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

    compareSchools(s1: School, s2: School): boolean {
        return s1 && s2 ? s1.id === s2.id : s1 === s2;
    }
}
