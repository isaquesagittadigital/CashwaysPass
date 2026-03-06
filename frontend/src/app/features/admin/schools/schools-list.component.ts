import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SchoolManagementService, School } from '../../../core/services/school-management.service';
import { AdminDashboardService } from '../../../core/services/admin-dashboard.service';
import { SchoolService as GlobalSchoolService } from '../../../core/services/school.service';
import { LucideAngularModule, Plus, Search, Pencil, Trash2, Building2, ChevronLeft, ChevronRight } from 'lucide-angular';
import { Router, RouterModule } from '@angular/router';
import { DeleteConfirmModalComponent } from '../../../shared/components/delete-confirm-modal/delete-confirm-modal.component';

@Component({
    selector: 'app-schools-list',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, RouterModule, DeleteConfirmModalComponent],
    templateUrl: './schools-list.component.html',
    styleUrls: ['./schools-list.component.css']
})
export class SchoolsListComponent implements OnInit {
    icons = { Plus, Search, Pencil, Trash2, Building2, ChevronLeft, ChevronRight };
    allSchools: any[] = [];
    filteredSchools: any[] = [];
    isLoading = true;
    showDeleteModal = false;
    schoolToDeleteId: string | null = null;
    deleteLoading = false;

    // Filters & Pagination
    searchTerm: string = '';
    statusFilter: string = '';
    currentPage: number = 1;
    pageSize: number = 10;
    protected Math = Math;

    constructor(
        private schoolService: SchoolManagementService,
        private dashboardService: AdminDashboardService,
        private globalSchoolService: GlobalSchoolService,
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
                this.allSchools = schoolsWithStats;
                this.applyFilters();
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading schools:', err);
                this.isLoading = false;
            }
        });
    }

    applyFilters() {
        this.filteredSchools = this.allSchools.filter(school => {
            const matchesSearch = !this.searchTerm ||
                school.nome_fantasia?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                school.cnpj?.includes(this.searchTerm) ||
                school.email_contato?.toLowerCase().includes(this.searchTerm.toLowerCase());

            let matchesStatus = true;
            if (!this.statusFilter) {
                // "Todos" -> Mostrar ativos e inativos, ocultar deletados
                matchesStatus = !school.deletado;
            } else if (this.statusFilter === 'active') {
                // "Ativo" -> Apenas ativos (nunca deletados)
                matchesStatus = school.status === 'active' && !school.deletado;
            } else if (this.statusFilter === 'inactive') {
                // "Inativo" -> Inativos OU Deletados
                matchesStatus = school.status === 'inactive' || school.deletado === true;
            }

            return matchesSearch && matchesStatus;
        });
        this.currentPage = 1; // Reset to first page on filter change
    }

    get paginatedSchools() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        return this.filteredSchools.slice(startIndex, startIndex + this.pageSize);
    }

    get totalPages() {
        return Math.ceil(this.filteredSchools.length / this.pageSize);
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
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
            this.deleteLoading = true;
            this.schoolService.deleteSchool(this.schoolToDeleteId).subscribe({
                next: () => {
                    this.deleteLoading = false;
                    this.showDeleteModal = false;
                    this.schoolToDeleteId = null;
                    this.loadSchools();
                    this.globalSchoolService.loadSchools();
                },
                error: (err) => {
                    this.deleteLoading = false;
                    console.error('Erro ao excluir escola:', err);
                }
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
