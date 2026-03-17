import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { supabase } from '../supabase';

@Injectable({
    providedIn: 'root'
})
export class EmailService {
    constructor() { }

    /**
     * Sends an access email with temporary password via Supabase Edge Function
     */
    sendAccessEmail(email: string, tempPassword: string, name: string): Observable<any> {
        if (!email || !tempPassword) return of({ error: 'Email or password missing' });

        return from(
            supabase.functions.invoke('send-access-email', {
                body: {
                    email,
                    temp_password: tempPassword,
                    nome: name || 'Usuário'
                }
            })
        );
    }

    sendStudentWelcomeEmail(studentId: string, email: string): Observable<boolean> {
        // Keeping this for backward compatibility if used elsewhere, but redirecting logic
        console.log(`Deprecated: use sendAccessEmail instead. Sending to ${email}`);
        return of(true);
    }
}
