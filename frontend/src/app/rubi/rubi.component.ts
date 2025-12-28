import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rubi',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="panel">
      <h2>RUBI Interventions</h2>
      <p>Track intervention plans and adherence notes. Replace with form/list components backed by API calls.</p>
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
export class RubiComponent {}
