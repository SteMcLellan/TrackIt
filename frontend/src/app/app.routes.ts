import { Routes } from '@angular/router';
import { AuthGuard } from './shared/guards/auth.guard';
import { ParticipantStartGuard } from './shared/guards/participant-start.guard';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { LoginComponent } from './features/auth/login.component';
import { ParticipantCreateComponent } from './features/participants/participant-create.component';
import { ParticipantStartComponent } from './features/participants/participant-start.component';

/**
 * Application routes for the TrackIt frontend.
 */
export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard, ParticipantStartGuard] },
  { path: 'participants/start', component: ParticipantStartComponent, canActivate: [AuthGuard] },
  { path: 'participants/new', component: ParticipantCreateComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];
