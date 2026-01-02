import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CardComponent } from '../../shared/ui/card/card.component';
import { Participant } from '../../shared/models/participant';
import { environment } from '../../../environments/environment';

type ParticipantDetail = Omit<Participant, 'role'>;

@Component({
  selector: 'app-participant-detail',
  imports: [RouterLink, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card class="card">
      <a class="link" routerLink="/participants">Back to participants</a>

      @if (participantResource.isLoading()) {
        <p class="muted">Loading participant...</p>
      } @else if (participantResource.error()) {
        <p class="error" role="alert">Unable to load participant.</p>
      } @else {
        <h2>{{ displayName() }}</h2>
        <p class="muted">Age {{ participant()?.ageYears }}</p>

        <section class="section">
          <h3>Tracking history</h3>
          <p class="muted">Tracking history will appear here as you log entries.</p>
        </section>
      }
    </app-card>
  `,
  styles: [
    `
      .card {
        max-width: var(--layout-card-max, 36rem);
        margin: var(--space-6, 2rem) auto;
      }
      .link {
        display: inline-flex;
        margin-bottom: var(--space-3, 0.75rem);
        color: var(--color-primary, #0c4a6e);
        font-weight: 600;
        text-decoration: none;
      }
      h2 {
        margin: 0 0 var(--space-2, 0.5rem);
      }
      .muted {
        margin: 0 0 var(--space-3, 0.75rem);
        color: var(--color-text-muted, #64748b);
      }
      .section {
        margin-top: var(--space-4, 1rem);
        padding-top: var(--space-3, 0.75rem);
        border-top: 1px solid #e2e8f0;
      }
      .error {
        margin: 0;
        color: #b91c1c;
        font-weight: 600;
      }
    `
  ]
})
export class ParticipantDetailComponent {
  private readonly route = inject(ActivatedRoute);

  readonly participantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' }
  );

  readonly participantResource = httpResource<ParticipantDetail>(() => ({
    url: `${environment.apiBaseUrl}/participants/${this.participantId()}`,
    method: 'GET'
  }));

  readonly participant = computed(() =>
    this.participantResource.hasValue() ? this.participantResource.value() : null
  );

  readonly displayName = computed(() => {
    const participant = this.participant();
    if (!participant) {
      return 'Participant';
    }
    return participant.displayName?.trim() || 'Participant';
  });
}
