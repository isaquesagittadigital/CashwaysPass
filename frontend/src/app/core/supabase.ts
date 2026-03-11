import { createClient } from '@supabase/supabase-js';
import { showLoading, hideLoading } from './services/loading.service';
import { environment } from '../../environments/environment';

export const supabaseUrl = environment.supabaseUrl;
export const supabaseKey = environment.supabaseKey;

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
