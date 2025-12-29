import { Component } from '@angular/core';

import { AuthService } from '../core/services/auth.service';

@Component({
    selector: 'app-dashboard',
    imports: [],
    template: `
    <section class="panel">
      <h2>Welcome back, {{ auth.appUserSnapshot?.name || 'friend' }}!</h2>
      <p>Use the navigation above to manage meds, symptoms, and RUBI interventions.</p>
      <ul>
        <li>Email: {{ auth.appUserSnapshot?.email }}</li>
        <li>Role: {{ auth.appUserSnapshot?.role || 'parent' }}</li>
      </ul>
    </section>
  `,
    styles: [
        `
      .panel {
        background: #fff;
        padding: 1.5rem;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      }
    `
    ]
})
export class DashboardComponent {
  constructor(public auth: AuthService) {}
}
