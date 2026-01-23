import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';
import { authInterceptor } from './app/shared/interceptors/auth.interceptor';
import { authExpiredInterceptor } from './app/shared/interceptors/auth-expired.interceptor';

/**
 * Bootstraps the TrackIt application with zoneless change detection.
 */
bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor, authExpiredInterceptor]))
  ]
}).catch((err) => console.error(err));
