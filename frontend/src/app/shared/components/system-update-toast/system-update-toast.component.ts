import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, RefreshCw, X } from 'lucide-angular';
import { supabase } from '../../../core/supabase';

@Component({
  selector: 'app-system-update-toast',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './system-update-toast.component.html',
  styleUrl: './system-update-toast.component.css'
})
export class SystemUpdateToastComponent implements OnInit, OnDestroy {
  icons = { RefreshCw, X };

  hasUpdate = false;
  currentVersion: string | null = null;
  private intervalId: any;

  // Verifica a cada 5 minutos
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000;

  ngOnInit() {
    this.checkForUpdates(true);

    this.intervalId = setInterval(() => {
      this.checkForUpdates(false);
    }, this.CHECK_INTERVAL_MS);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async checkForUpdates(isInitialLoad: boolean) {
    try {
      const { data, error } = await supabase
        .from('versionamento')
        .select('version_string')
        .eq('id', 1)
        .single();

      if (data && !error) {
        if (isInitialLoad) {
          // Salva a versão atual quando carrega a primeira vez
          this.currentVersion = data.version_string;
        } else if (this.currentVersion && this.currentVersion !== data.version_string) {
          // Se mudou da versão inicial, avisa
          this.hasUpdate = true;
        }
      }
    } catch (err) {
      console.error('Erro ao verificar atualização do sistema:', err);
    }
  }

  reloadApp() {
    window.location.reload();
  }

  dismiss() {
    this.hasUpdate = false;
  }
}
