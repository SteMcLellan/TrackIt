import { Routes } from '@angular/router';
import { AuthGuard } from './shared/guards/auth.guard';
import { ActiveParticipantGuard } from './shared/guards/active-participant.guard';
import { HomeComponent } from './features/home/home.component';
import { LoginComponent } from './features/auth/login.component';
import { AnalyticsComponent } from './features/analytics/analytics.component';
import { IncidentCreateComponent } from './features/incidents/incident-create.component';
import { IncidentDetailComponent } from './features/incidents/incident-detail.component';
import { IncidentListComponent } from './features/incidents/incident-list.component';
import { MedicationListComponent } from './features/medications/medication-list.component';
import { MedicationLogComponent } from './features/medications/medication-log.component';
import { MedicationAdherenceComponent } from './features/medications/medication-adherence.component';
import { TimelineComponent } from './features/timeline/timeline.component';
import { ParticipantCreateComponent } from './features/participants/participant-create.component';
import { ParticipantDetailComponent } from './features/participants/participant-detail.component';
import { ParticipantListComponent } from './features/participants/participant-list.component';
import { ParticipantStartComponent } from './features/participants/participant-start.component';
import { InviteAcceptComponent } from './features/invites/invite-accept.component';

/**
 * Application routes for the TrackIt frontend.
 */
export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'invite/:participantId/:inviteId', component: InviteAcceptComponent, canActivate: [AuthGuard] },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard, ActiveParticipantGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [AuthGuard, ActiveParticipantGuard] },
  { path: 'incidents', component: IncidentListComponent, canActivate: [AuthGuard] },
  { path: 'incidents/new', component: IncidentCreateComponent, canActivate: [AuthGuard] },
  { path: 'incidents/:id', component: IncidentDetailComponent, canActivate: [AuthGuard] },
  { path: 'medications', component: MedicationLogComponent, canActivate: [AuthGuard] },
  { path: 'medications/list', component: MedicationListComponent, canActivate: [AuthGuard] },
  { path: 'medications/history', component: MedicationAdherenceComponent, canActivate: [AuthGuard] },
  { path: 'timeline', component: TimelineComponent, canActivate: [AuthGuard, ActiveParticipantGuard] },
  { path: 'participants', component: ParticipantListComponent, canActivate: [AuthGuard] },
  { path: 'participants/start', component: ParticipantStartComponent, canActivate: [AuthGuard] },
  { path: 'participants/new', component: ParticipantCreateComponent, canActivate: [AuthGuard] },
  { path: 'participants/:id', component: ParticipantDetailComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: '/home', pathMatch: 'full' }
];
