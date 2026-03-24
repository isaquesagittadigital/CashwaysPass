import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { supabase } from '../supabase';

@Injectable({
    providedIn: 'root'
})
export class EmailService {
    constructor() { }

    /**
     * Sends an access email with password via Supabase Edge Function
     */
    sendAccessEmail(email: string, accessPassword: string, name: string): Observable<any> {
        if (!email || !accessPassword) return of({ error: 'Email or password missing' });

        return from(
            supabase.functions.invoke('send-access-email', {
                body: {
                    email,
                    temp_password: accessPassword,
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
