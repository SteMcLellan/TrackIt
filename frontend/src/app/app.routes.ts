import { Routes } from '@angular/router';
import { AuthGuard } from './shared/guards/auth.guard';
import { ActiveParticipantGuard } from './shared/guards/active-participant.guard';
import { LoginComponent } from './features/auth/login.component';
import { IncidentCreateComponent } from './features/incidents/incident-create.component';
import { IncidentDetailComponent } from './features/incidents/incident-detail.component';
import { IncidentListComponent } from './features/incidents/incident-list.component';
import { TimelineComponent } from './features/timeline/timeline.component';
import { InviteAcceptComponent } from './features/invites/invite-accept.component';
import { ShellComponent } from './shell/shell.component';
import { InsightsDashboardComponent } from './features/insights/insights-dashboard.component';
import { ProfileDashboardComponent } from './features/profile/profile-dashboard.component';
import { DailyReflectionComponent } from './features/daily-reflection/daily-reflection.component';

/**
 * Application routes for the TrackIt frontend.
 */
export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'invite/:participantId/:inviteId', component: InviteAcceptComponent, canActivate: [AuthGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'insights', pathMatch: 'full' },
      { path: 'insights', component: InsightsDashboardComponent, canActivate: [ActiveParticipantGuard] },
      { path: 'daily-reflection', component: DailyReflectionComponent, canActivate: [ActiveParticipantGuard] },
      { path: 'timeline', component: TimelineComponent, canActivate: [ActiveParticipantGuard] },
      { path: 'profile', component: ProfileDashboardComponent, canActivate: [ActiveParticipantGuard] }
    ]
  },
  { path: 'home', redirectTo: '/insights', pathMatch: 'full' },
  { path: 'analytics', redirectTo: '/insights', pathMatch: 'full' },
  { path: 'incidents', component: IncidentListComponent, canActivate: [AuthGuard] },
  { path: 'incidents/new', component: IncidentCreateComponent, canActivate: [AuthGuard] },
  { path: 'incidents/:id', component: IncidentDetailComponent, canActivate: [AuthGuard] }
];
