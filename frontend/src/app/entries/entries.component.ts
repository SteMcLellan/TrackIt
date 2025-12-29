import { Component } from '@angular/core';


@Component({
    selector: 'app-entries',
    imports: [],
    template: `
    <section class="panel">
      <h2>Meds & Symptoms</h2>
      <p>Stubbed view for medication schedules and symptom logging. Wire this to protected API routes.</p>
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
export class EntriesComponent {}
