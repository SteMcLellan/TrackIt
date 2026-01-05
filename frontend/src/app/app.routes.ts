import { Routes } from '@angular/router';
import { AuthGuard } from './shared/guards/auth.guard';
import { ParticipantStartGuard } from './shared/guards/participant-start.guard';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { LoginComponent } from './features/auth/login.component';
import { IncidentCreateComponent } from './features/incidents/incident-create.component';
import { IncidentDetailComponent } from './features/incidents/incident-detail.component';
import { IncidentListComponent } from './features/incidents/incident-list.component';
import { ParticipantCreateComponent } from './features/participants/participant-create.component';
import { ParticipantDetailComponent } from './features/participants/participant-detail.component';
import { ParticipantListComponent } from './features/participants/participant-list.component';
import { ParticipantStartComponent } from './features/participants/participant-start.component';

/**
 * Application routes for the TrackIt frontend.
 */
export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard, ParticipantStartGuard] },
  { path: 'incidents', component: IncidentListComponent, canActivate: [AuthGuard] },
  { path: 'incidents/new', component: IncidentCreateComponent, canActivate: [AuthGuard] },
  { path: 'incidents/:id', component: IncidentDetailComponent, canActivate: [AuthGuard] },
  { path: 'participants', component: ParticipantListComponent, canActivate: [AuthGuard] },
  { path: 'participants/start', component: ParticipantStartComponent, canActivate: [AuthGuard] },
  { path: 'participants/new', component: ParticipantCreateComponent, canActivate: [AuthGuard] },
  { path: 'participants/:id', component: ParticipantDetailComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];
