import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export const globalLoadingSubject = new BehaviorSubject<boolean>(false);
let activeCount = 0;
let timeoutId: any = null;

export const showLoading = () => {
    activeCount++;
    if (activeCount === 1) {
        // Only show loader if the request takes more than 2 seconds (2000ms)
        timeoutId = setTimeout(() => {
            globalLoadingSubject.next(true);
        }, 2000);
    }
};

export const hideLoading = () => {
    activeCount--;
    if (activeCount <= 0) {
        activeCount = 0;

        // If the request finished before the 2s timeout, clear it so it never shows
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        // Hide it in case it was already showing
        globalLoadingSubject.next(false);
    }
};

@Injectable({ providedIn: 'root' })
export class LoadingService {
    isLoading$ = globalLoadingSubject.asObservable();

    show() { showLoading(); }
    hide() { hideLoading(); }
}
