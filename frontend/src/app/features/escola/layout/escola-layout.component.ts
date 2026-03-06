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
    User,
    UserPlus
} from 'lucide-angular';
import { LogoComponent } from '../../../components/logo/logo.component';
import { SchoolService, School } from '../../../core/services/school.service';

@Component({
    selector: 'app-escola-layout',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, LogoComponent, RouterModule, RouterOutlet, FormsModule],
    templateUrl: './escola-layout.component.html',
})
export class EscolaLayoutComponent implements OnInit, OnDestroy {
    sidebarOpen = true;
    activeRoute = 'dashboard';

    icons = {
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
        User,
        UserPlus
    };

    schools: School[] = [];
    selectedSchool: School | null = null;
    canChangeSchool = true;
    currentUser: any = null;
    isSchoolUser = false;
    private searchSub?: Subscription;

    menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', route: 'dashboard', active: false },
        { icon: FileText, label: 'Cadastro', route: 'cadastro', active: false },
        { icon: Wallet, label: 'Carteira', route: 'carteira', active: false },
        { icon: Package, label: 'Produtos', route: 'produtos', active: false },
        { icon: CalendarDays, label: 'Eventos', route: 'eventos', active: false },
        { icon: User, label: 'Perfil', route: 'perfil', active: false },
    ];

    constructor(
        private router: Router,
        private schoolService: SchoolService
    ) { }

    ngOnInit() {
        const userStr = localStorage.getItem('currentUser');
        let userEscolaId: string | null = null;
        let isSchoolUser = false;

        if (userStr) {
            this.currentUser = JSON.parse(userStr);
            this.isSchoolUser = this.currentUser.tipo_acesso === 'Escola';
            userEscolaId = this.currentUser.escola_id;
            this.canChangeSchool = !this.isSchoolUser;
        }

        this.schoolService.schools$.subscribe(s => {
            if (this.isSchoolUser && userEscolaId) {
                // Robust ID comparison
                this.schools = s.filter(school =>
                    school.id?.toLowerCase().trim() === userEscolaId?.toLowerCase().trim()
                );
            } else {
                this.schools = s;
            }

            // Sync selected school with the filtered list
            if (this.isSchoolUser && userEscolaId && this.schools.length > 0) {
                const mySchool = this.schools[0];
                this.schoolService.selectSchool(mySchool);
            }
        });

        this.schoolService.selectedSchool$.subscribe(s => {
            if (s) {
                // Ensure the selected school reference matches one in the current 'this.schools' array
                // for [ngValue] to work correctly in the <select>
                const match = this.schools.find(school => school.id === s.id);
                this.selectedSchool = match || s;
            } else {
                this.selectedSchool = null;
            }
        });

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
            item.active = url.includes(`/escola/${item.route}`);
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
        this.router.navigate(['/escola', route]);
    }

    logout() {
        localStorage.removeItem('currentUser');
        this.router.navigate(['/']);
    }

    navigateToProfile() {
        this.router.navigate(['/escola/perfil']);
    }
}
