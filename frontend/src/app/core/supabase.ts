import { createClient } from '@supabase/supabase-js';
import { showLoading, hideLoading } from './services/loading.service';

export const supabaseUrl = 'https://xlupnknqblvvlcfprghr.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsdXBua25xYmx2dmxjZnByZ2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NzE4ODksImV4cCI6MjA3NzE0Nzg4OX0.wHM9ZdTKbZvXw7hF-1Et5QLY9vOU2omTJzD6rRDVvyA';

// Simple fallback lock to prevent Zone.js NavigatorLockAcquireTimeoutError
const customLock = async (name: string, acquireTimeout: number, fn: () => Promise<any>): Promise<any> => {
    // Just execute the function without native navigator.locks if it's causing deadlocks in Angular
    // For a more robust approach in multiple tabs, we would use a library, but for this issue, direct execution usually bypasses the Zone.js conflict
    return await fn();
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        lock: customLock,
        persistSession: true,
        autoRefreshToken: true,
    },
    global: {
        fetch: async (url, options) => {
            showLoading();
            try {
                return await fetch(url, options);
            } finally {
                hideLoading();
            }
        }
    }
});
