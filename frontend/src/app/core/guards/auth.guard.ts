import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  const storedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  
  if (!storedUser) {
    router.navigate(['/']);
    return false;
  }

  try {
    const user = JSON.parse(storedUser);
    
    // Check session expiration
    if (user.sessionExpiration && new Date().getTime() > user.sessionExpiration) {
      localStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentUser');
      router.navigate(['/']);
      return false;
    }

    const userType = user.tipo_acesso?.toLowerCase();
    const path = state.url;

    // Protection for /admin
    if (path.startsWith('/admin')) {
      if (userType !== 'admin' && userType !== 'administrador') {
        router.navigate(['/']);
        return false;
      }
    }

    // Protection for /escola
    if (path.startsWith('/escola')) {
      if (userType !== 'escola' && userType !== 'admin' && userType !== 'administrador') {
        router.navigate(['/']);
        return false;
      }
    }

    return true;
  } catch (e) {
    router.navigate(['/']);
    return false;
  }
};
