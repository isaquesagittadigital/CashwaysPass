import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class EmailService {
    constructor() { }

    sendStudentWelcomeEmail(studentId: string, email: string): Observable<boolean> {
        // Placeholder logic for calling the edge function
        console.log(`Sending welcome email to student ${studentId} at ${email}`);
        // Simulate network delay to show loading state in UI
        return of(true).pipe(delay(1500));
    }
}
