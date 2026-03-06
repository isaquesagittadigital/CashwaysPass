import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { supabase } from '../../core/supabase';

export interface School {
    id: string;
    name: string;
}

@Injectable({
    providedIn: 'root'
})
export class SchoolService {
    private schoolsSubject = new BehaviorSubject<School[]>([]);
    private selectedSchoolSubject = new BehaviorSubject<School | null>(null);

    schools$: Observable<School[]> = this.schoolsSubject.asObservable();
    selectedSchool$: Observable<School | null> = this.selectedSchoolSubject.asObservable();

    constructor() {
        this.loadSchools();
    }

    async loadSchools() {
        try {
            const { data, error } = await supabase
                .from('escola')
                .select('id, nome_fantasia')
                .eq('deletado', false);

            if (error) throw error;

            if (data) {
                const schools = data.map(s => ({
                    id: s.id,
                    name: s.nome_fantasia || 'Sem Nome'
                }));
                this.schoolsSubject.next(schools);

                // Default to first school if none selected
                if (schools.length > 0 && !this.selectedSchoolSubject.value) {
                    this.selectedSchoolSubject.next(schools[0]);
                }
            }
        } catch (error) {
            console.error('Error loading schools:', error);
        }
    }

    selectSchool(school: School) {
        this.selectedSchoolSubject.next(school);
    }

    getSelectedSchoolId(): string | null {
        return this.selectedSchoolSubject.value?.id || null;
    }

    getSelectedSchool(): School | null {
        return this.selectedSchoolSubject.value;
    }
}
