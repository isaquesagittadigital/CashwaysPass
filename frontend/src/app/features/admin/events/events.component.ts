import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
    LucideAngularModule,
    ArrowLeft,
    Search,
    Plus,
    Eye,
    Pencil,
    Trash2,
    X,
    CalendarDays,
    Users,
    CheckCircle2,
    Upload,
    Mail,
    ChevronDown,
    PlusCircle
} from 'lucide-angular';
import { EventoService, Evento } from '../../../core/services/evento.service';
import { SchoolService, School } from '../../../core/services/school.service';

@Component({
    selector: 'app-events',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './events.component.html',
})
export class EventsComponent implements OnInit, OnDestroy {
    icons = {
        ArrowLeft, Search, Plus, Eye, Pencil, Trash2, X,
        CalendarDays, Users, CheckCircle2, Upload, Mail,
        ChevronDown, PlusCircle
    };

    // Data
    eventos: Evento[] = [];
    turmas: any[] = [];
    loading = false;
    searchTerm = '';
    statusFilter = '';
    selectedSchoolId: string | null = null;
    private schoolSub?: Subscription;

    // Form Modal
    showFormModal = false;
    isEditing = false;
    editingEventId: string | null = null;
    formLoading = false;
    imageFile: File | null = null;
    imagePreview: string = '';

    // New Event Form State
    form = {
        nome: '',
        descricao_curta: '',
        data_evento: '',
        turma_id: '',
        ativo: true,
        capa_url: '',
        lojistas_convidados: [] as string[]
    };
    newLojistaEmail = '';

    // Delete Modal
    showDeleteModal = false;
    deleteEventId: string | null = null;
    deleteLoading = false;

    // Success Toast
    showSuccessToast = false;
    successTitle = '';
    successMessage = '';

    constructor(
        private eventoService: EventoService,
        private schoolService: SchoolService,
        private router: Router
    ) { }

    ngOnInit() {
        this.schoolSub = this.schoolService.selectedSchool$.subscribe(s => {
            this.selectedSchoolId = s?.id || null;
            if (this.selectedSchoolId) {
                this.loadEventos();
                this.loadTurmas();
            }
        });
    }

    ngOnDestroy() {
        this.schoolSub?.unsubscribe();
    }

    async loadEventos() {
        if (!this.selectedSchoolId) return;
        this.loading = true;
        this.eventos = await this.eventoService.getEventos(
            this.selectedSchoolId,
            this.searchTerm,
            this.statusFilter
        );
        this.loading = false;
    }

    async loadTurmas() {
        if (!this.selectedSchoolId) return;
        this.turmas = await this.eventoService.getTurmas(this.selectedSchoolId);
    }

    onSearch() {
        this.loadEventos();
    }

    onStatusChange() {
        this.loadEventos();
    }

    goBack() {
        this.router.navigate(['/admin/dashboard']);
    }

    // --- Helpers ---
    getEventStatus(data: string): { label: string, class: string } {
        if (!data) return { label: 'Agendado', class: 'bg-blue-100 text-blue-700' };

        const eventDate = new Date(data + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (eventDate < today) {
            return { label: 'Realizado', class: 'bg-gray-100 text-gray-500' };
        }
        return { label: 'Agendado', class: 'bg-blue-100 text-blue-700' };
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    getTurmaName(turmaId: string): string {
        const turma = this.turmas.find(t => t.id === turmaId);
        return turma ? turma.nome : 'Nenhuma turma';
    }

    // --- Form Actions ---
    openCreateModal() {
        this.isEditing = false;
        this.editingEventId = null;
        this.resetForm();
        this.showFormModal = true;
    }

    async openEditModal(event: Evento) {
        this.isEditing = true;
        this.editingEventId = event.id;
        this.form = {
            nome: event.nome,
            descricao_curta: event.descricao_curta || '',
            data_evento: event.data_evento || '',
            turma_id: event.turma_id || '',
            ativo: event.ativo,
            capa_url: event.capa_url || '',
            lojistas_convidados: [...(event.lojistas_convidados || [])]
        };
        this.imagePreview = event.capa_url || '';
        this.imageFile = null;
        this.showFormModal = true;
    }

    resetForm() {
        this.form = {
            nome: '',
            descricao_curta: '',
            data_evento: '',
            turma_id: '',
            ativo: true,
            capa_url: '',
            lojistas_convidados: []
        };
        this.imagePreview = '';
        this.imageFile = null;
        this.newLojistaEmail = '';
    }

    closeFormModal() {
        this.showFormModal = false;
    }

    onImageSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.imageFile = file;
            const reader = new FileReader();
            reader.onload = (e: any) => this.imagePreview = e.target.result;
            reader.readAsDataURL(file);
        }
    }

    addLojista() {
        if (this.newLojistaEmail && this.newLojistaEmail.includes('@')) {
            if (!this.form.lojistas_convidados.includes(this.newLojistaEmail)) {
                this.form.lojistas_convidados.push(this.newLojistaEmail);
            }
            this.newLojistaEmail = '';
        }
    }

    removeLojista(email: string) {
        this.form.lojistas_convidados = this.form.lojistas_convidados.filter(e => e !== email);
    }

    async submitForm() {
        if (!this.selectedSchoolId || !this.form.nome) return;

        this.formLoading = true;

        try {
            // Upload image if selected
            if (this.imageFile) {
                const url = await this.eventoService.uploadCapa(this.imageFile);
                if (url) this.form.capa_url = url;
            }

            const dataToSave = {
                ...this.form,
                escola_id: this.selectedSchoolId,
                updated_at: new Date().toISOString()
            };

            let result;
            if (this.isEditing && this.editingEventId) {
                result = await this.eventoService.updateEvento(this.editingEventId, dataToSave);
                if (result.success) {
                    this.showSuccess('Evento atualizado!', 'As alterações foram salvas com sucesso.');
                }
            } else {
                result = await this.eventoService.createEvento({
                    ...dataToSave,
                    created_at: new Date().toISOString()
                });
                if (result.success) {
                    this.showSuccess('Evento cadastrado!', 'O evento foi cadastrado com sucesso!');
                }
            }

            if (result.success) {
                this.closeFormModal();
                this.loadEventos();
            }
        } catch (error) {
            console.error('Error saving event:', error);
        } finally {
            this.formLoading = false;
        }
    }

    // --- Delete Actions ---
    openDeleteModal(id: string) {
        this.deleteEventId = id;
        this.showDeleteModal = true;
    }

    async confirmDelete() {
        if (!this.deleteEventId) return;
        this.deleteLoading = true;

        const result = await this.eventoService.deleteEvento(this.deleteEventId);
        if (result.success) {
            this.showSuccess('Evento excluído!', 'O evento foi excluído com sucesso!');
            this.loadEventos();
            this.showDeleteModal = false;
        }
        this.deleteLoading = false;
    }

    // --- Feedback ---
    showSuccess(title: string, message: string) {
        this.successTitle = title;
        this.successMessage = message;
        this.showSuccessToast = true;
    }

    closeSuccessToast() {
        this.showSuccessToast = false;
    }
}
