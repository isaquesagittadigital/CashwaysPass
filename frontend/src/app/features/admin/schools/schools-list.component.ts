import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolManagementService, School } from '../../../core/services/school-management.service';
import { AdminDashboardService } from '../../../core/services/admin-dashboard.service';
import { LucideAngularModule, Plus, Search, Settings, Trash2, Building2 } from 'lucide-angular';
import { Router, RouterModule } from '@angular/router';
import { DeleteConfirmModalComponent } from '../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';

@Component({
    selector: 'app-schools-list',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, RouterModule, DeleteConfirmModalComponent],
    templateUrl: './schools-list.component.html',
    styleUrls: ['./schools-list.component.css']
})
export class SchoolsListComponent implements OnInit {
    icons = { Plus, Search, Settings, Trash2, Building2 };
    schools: any[] = [];
    isLoading = true;
    showDeleteModal = false;
    schoolToDeleteId: string | null = null;

    constructor(
        private schoolService: SchoolManagementService,
        private dashboardService: AdminDashboardService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadSchools();
    }

    loadSchools() {
        this.isLoading = true;
        this.schoolService.getSchools().subscribe({
            next: async (data) => {
                const schoolsWithStats = await Promise.all(data.map(async (school) => {
                    try {
                        const stats = await this.dashboardService.getDashboardStats(school.id, '12 meses');
                        return { ...school, stats };
                    } catch {
                        return { ...school, stats: null };
                    }
                }));
                this.schools = schoolsWithStats;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading schools:', err);
                this.isLoading = false;
            }
        });
    }

    onEdit(school: School) {
        // This will open a modal or navigate to a details page
        this.router.navigate(['/admin/escolas', school.id]);
    }

    onDelete(id: string) {
        this.schoolToDeleteId = id;
        this.showDeleteModal = true;
    }

    confirmDelete() {
        if (this.schoolToDeleteId) {
            this.schoolService.deleteSchool(this.schoolToDeleteId).subscribe(() => {
                this.loadSchools();
                this.showDeleteModal = false;
                this.schoolToDeleteId = null;
            });
        }
    }

    cancelDelete() {
        this.showDeleteModal = false;
        this.schoolToDeleteId = null;
    }

    getStatusClass(status: string) {
        return status === 'active'
            ? 'bg-green-100 text-green-600'
            : 'bg-red-100 text-red-600';
    }

    formatCurrency(value: number | undefined): string {
        if (value === undefined) return '---';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
}
