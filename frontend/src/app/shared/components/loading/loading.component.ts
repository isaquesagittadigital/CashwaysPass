import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../core/services/loading.service';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="loadingService.isLoading$ | async" 
         class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm transition-all duration-300">
      
      <!-- Logo Monogram -->
      <div class="mb-4 relative flex justify-center items-center">
        <svg width="40" height="49" viewBox="0 0 40 49" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-16 h-20 animate-pulse">
            <path
                d="M35.3281 33.4034L31.0226 30.9171C30.9061 30.8493 30.7602 30.8893 30.6907 31.004C28.3729 34.8473 24.156 37.4205 19.3344 37.4205C18.7002 37.4205 18.0747 37.3754 17.4683 37.2885C15.6022 37.0261 13.8613 36.378 12.3323 35.4224C10.4923 34.2722 8.9511 32.6824 7.85995 30.7972C6.73231 28.8512 6.08596 26.5872 6.08596 24.1738C6.08596 21.7605 6.73057 19.4948 7.85995 17.5453C10.15 13.5873 14.4312 10.9219 19.3344 10.9219C19.9686 10.9219 20.5941 10.9671 21.2005 11.054C23.0665 11.3163 24.8075 11.9679 26.3365 12.9253C28.1088 14.0338 29.6065 15.5454 30.6907 17.3403C30.7602 17.4549 30.9061 17.4949 31.0226 17.4271L35.3246 14.9408C35.4445 14.8713 35.4845 14.7166 35.415 14.5985C33.6914 11.7038 31.205 9.31647 28.2356 7.71103L30.9183 0.330125C30.9774 0.170275 30.8575 0 30.6872 0H25.3965C25.2923 0 25.2002 0.0642875 25.1654 0.161588L23.0996 5.83626C21.885 5.58954 20.6254 5.45749 19.3361 5.45749C12.4122 5.45749 6.3657 9.22091 3.13047 14.8104C1.53545 17.5626 0.625 20.7614 0.625 24.1721C0.625 27.5828 1.53892 30.7781 3.13221 33.5285C4.86102 36.5205 7.3943 38.986 10.4349 40.6332L7.75049 48.0106C7.69141 48.1705 7.8113 48.3407 7.98157 48.3407H13.2723C13.3765 48.3407 13.4686 48.2764 13.5033 48.1791L15.5692 42.5045C16.7837 42.7512 18.0434 42.8832 19.3327 42.8832C26.1662 42.8832 32.1467 39.2171 35.415 33.7457C35.4862 33.6276 35.4445 33.4729 35.3246 33.4034H35.3281Z"
                fill="url(#paint0_linear_86_6475_loader)" />
            <path
                d="M19.3342 44.1725C21.1638 44.1725 22.9326 43.9292 24.6162 43.467L22.9013 48.1791C22.8666 48.2764 22.7727 48.3407 22.6702 48.3407H17.3865C17.2162 48.3407 17.0963 48.1705 17.1554 48.0106L18.5576 44.1534H18.561C18.8199 44.169 19.0753 44.1725 19.3325 44.1725H19.3342Z"
                fill="#ADD136" />
            <path
                d="M21.5134 0.330125L20.1112 4.18738C19.8523 4.17174 19.5934 4.16826 19.3345 4.16826C17.505 4.16826 15.7327 4.41499 14.0491 4.87716L15.764 0.161588C15.7987 0.0642875 15.8926 0 15.9951 0H21.2823C21.4526 0 21.5724 0.170275 21.5134 0.330125Z"
                fill="#ADD136" />
            <defs>
                <linearGradient id="paint0_linear_86_6475_loader" x1="6.01472" y1="47.2426" x2="32.6558" y2="1.0981" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#164396" />
                    <stop offset="0.8" stop-color="#00A0DD" />
                </linearGradient>
            </defs>
        </svg>
      </div>
      
      <!-- Text -->
      <div class="flex flex-col items-center">
        <h3 class="text-lg font-bold text-gray-800 tracking-wide">CashWays App</h3>
        <div class="flex items-center gap-1 mt-1">
          <p class="text-sm font-semibold text-gray-500">Carregando dados</p>
          <span class="flex gap-0.5">
            <span class="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
            <span class="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
          </span>
        </div>
      </div>
    </div>
  `
})
export class LoadingComponent {
  constructor(public loadingService: LoadingService) { }
}
