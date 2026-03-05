import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
    LucideAngularModule,
    ArrowLeft,
    Mail,
    Lock,
    UploadCloud,
    X,
    CheckCircle2,
    Info,
    HelpCircle
} from 'lucide-angular';
import { ProfileService, UserProfile } from '../../../core/services/profile.service';

@Component({
    selector: 'app-perfil',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, LucideAngularModule],
    templateUrl: './perfil.component.html',
})
export class PerfilComponent implements OnInit {
    icons = {
        ArrowLeft, Mail, Lock, UploadCloud, X, CheckCircle2, Info, HelpCircle
    };

    profileForm: FormGroup;
    passwordForm: FormGroup;

    loading = false;
    uploading = false;
    showSuccessModal = false;
    showPasswordSuccessModal = false;

    profile?: UserProfile;
    previewUrl?: string;
    selectedFile?: File;
    isAdmin = true;

    constructor(
        private fb: FormBuilder,
        private profileService: ProfileService,
        private router: Router
    ) {
        this.profileForm = this.fb.group({
            nome_completo: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
        });

        this.passwordForm = this.fb.group({
            current_password: ['', Validators.required],
            new_password: ['', [Validators.required, Validators.minLength(6)]],
            confirm_password: ['', Validators.required]
        }, { validator: this.passwordMatchValidator });
    }

    get canSaveProfile() {
        return (this.profileForm.valid || this.selectedFile) && !this.loading;
    }

    get canUpdatePassword() {
        return this.passwordForm.valid && !this.loading;
    }

    async ngOnInit() {
        this.loading = true;
        try {
            const p = await this.profileService.getProfile();
            if (p) {
                this.profile = p;
                this.profileForm.patchValue({
                    nome_completo: p.nome_completo,
                    email: p.email
                });
                if (p.foto_url) this.previewUrl = p.foto_url;
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            this.loading = false;
        }
    }

    passwordMatchValidator(g: FormGroup) {
        return g.get('new_password')?.value === g.get('confirm_password')?.value
            ? null : { mismatch: true };
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e: any) => this.previewUrl = e.target.result;
            reader.readAsDataURL(file);
        }
    }

    async saveProfile() {
        if (this.profileForm.invalid) return;

        this.loading = true;
        try {
            if (this.selectedFile) {
                await this.profileService.updateAvatar(this.selectedFile);
            }
            await this.profileService.updateProfile(this.profileForm.value);
            this.showSuccessModal = true;
        } catch (error) {
            console.error('Error saving profile:', error);
        } finally {
            this.loading = false;
        }
    }

    async updatePassword() {
        if (this.passwordForm.invalid) return;

        this.loading = true;
        try {
            await this.profileService.changePassword(this.passwordForm.value.new_password);
            this.showPasswordSuccessModal = true;
            this.passwordForm.reset();
        } catch (error) {
            console.error('Error updating password:', error);
        } finally {
            this.loading = false;
        }
    }

    goBack() {
        this.router.navigate(['/admin/dashboard']);
    }

    closeModals() {
        this.showSuccessModal = false;
        this.showPasswordSuccessModal = false;
    }
}
