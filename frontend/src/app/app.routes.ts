import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './auth/login.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];
