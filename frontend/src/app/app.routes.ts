import { Routes } from '@angular/router';
import { AuthGuard } from './shared/guards/auth.guard';
import { ActiveParticipantGuard } from './shared/guards/active-participant.guard';
import { LoginComponent } from './features/auth/login.component';
import { BehavioralMomentCreateComponent } from './features/incidents/behavioral-moment-create.component';
import { TimelineComponent } from './features/timeline/timeline.component';
import { InviteAcceptComponent } from './features/invites/invite-accept.component';
import { ShellComponent } from './shared/ui/page/shell.component';
import { InsightsDashboardComponent } from './features/insights/insights-dashboard.component';
import { ProfileDashboardComponent } from './features/profile/profile-dashboard.component';
import { DailyReflectionComponent } from './features/daily-reflection/daily-reflection.component';
import { MedicationsDashboardComponent } from './features/medications/medications-dashboard.component';
import { ParticipantSetupComponent } from './features/onboarding/participant-setup.component';

/**
 * Application routes for the TrackIt frontend.
 */
export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'invite/:participantId/:inviteId', component: InviteAcceptComponent, canActivate: [AuthGuard] },
  { path: 'setup', component: ParticipantSetupComponent, canActivate: [AuthGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'insights', pathMatch: 'full' },
      { path: 'insights', component: InsightsDashboardComponent, canActivate: [ActiveParticipantGuard] },
      { path: 'medications', component: MedicationsDashboardComponent, canActivate: [ActiveParticipantGuard] },
      { path: 'daily-reflection', component: DailyReflectionComponent, canActivate: [ActiveParticipantGuard] },
      { path: 'behavioral-moments/new', component: BehavioralMomentCreateComponent, canActivate: [ActiveParticipantGuard] },
      { path: 'timeline', component: TimelineComponent, canActivate: [ActiveParticipantGuard] },
      { path: 'profile', component: ProfileDashboardComponent, canActivate: [ActiveParticipantGuard] }
    ]
  }
];
