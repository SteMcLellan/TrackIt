import { describe, expect, it, vi } from 'vitest';
import { createBehaviorIncidentInnerHandler, listBehaviorIncidentsInnerHandler } from '../../src/functions/behavior-incidents';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';
import { mockHttpRequest } from '../helpers/http';
import { expectValidationErrorIds } from '../helpers/assertions';
import { ParticipantContext } from '../../src/shared/handler-context';
import { appendTimelineEvent } from '../../src/shared/timeline/write-through';

vi.mock('../../src/shared/timeline/write-through', () => ({
  appendTimelineEvent: vi.fn().mockResolvedValue(undefined)
}));

function buildContext(): ParticipantContext {
  return {
    user: { sub: 'user-1', iat: 1, exp: 2 },
    containers: createCosmosContainersStub(),
    participantId: 'participant_1',
    link: {
      id: 'user-1:participant_1',
      userId: 'user-1',
      participantId: 'participant_1',
      role: 'manager',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  };
}

describe('behavior-incidents handlers', () => {
  it('listBehaviorIncidentsInnerHandler validates filter inputs', async () => {
    const response = await listBehaviorIncidentsInnerHandler(
      buildContext(),
      mockHttpRequest({ query: { function: 'bad', startDate: 'bad', endDate: 'bad' } })
    );
    expectValidationErrorIds(response, [
      'incidents.function.invalid',
      'incidents.startDate.invalid',
      'incidents.endDate.invalid'
    ]);
  });

  it('listBehaviorIncidentsInnerHandler returns paged response', async () => {
    const ctx = buildContext();
    (ctx.containers.behaviorIncidents.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchNext: vi.fn().mockResolvedValue({ resources: [{ id: 'incident_1' }], continuationToken: 'next' })
    });
    const response = await listBehaviorIncidentsInnerHandler(
      ctx,
      mockHttpRequest({ query: { pageSize: '10' } })
    );
    expect(response.status).toBe(200);
    expect((response.jsonBody as { nextToken: string | null }).nextToken).toBe('next');
  });

  it('createBehaviorIncidentInnerHandler returns body invalid', async () => {
    const response = await createBehaviorIncidentInnerHandler(
      buildContext(),
      mockHttpRequest({ method: 'POST', rawBodyString: '{bad-json' })
    );
    expectValidationErrorIds(response, ['incidents.body.invalid']);
  });

  it('createBehaviorIncidentInnerHandler validates payload', async () => {
    const response = await createBehaviorIncidentInnerHandler(
      buildContext(),
      mockHttpRequest({
        method: 'POST',
        body: {
          antecedent: '',
          behavior: '',
          consequence: '',
          place: '',
          logLocalDate: 'bad',
          logLocalTime: '99:99',
          logTzOffsetMinutes: 9999,
          function: 'bad'
        }
      })
    );
    expect((response.jsonBody as { errors: Array<{ id: string }> }).errors.length).toBeGreaterThan(0);
    expect(response.status).toBe(400);
  });

  it('createBehaviorIncidentInnerHandler creates incident and appends event', async () => {
    const ctx = buildContext();
    const createSpy = ctx.containers.behaviorIncidents.items.create as unknown as ReturnType<typeof vi.fn>;
    const response = await createBehaviorIncidentInnerHandler(
      ctx,
      mockHttpRequest({
        method: 'POST',
        body: {
          antecedent: 'A',
          behavior: 'B',
          consequence: 'C',
          place: 'Home',
          logLocalDate: '2026-02-01',
          logLocalTime: '10:00',
          logTzOffsetMinutes: 0,
          function: 'attention'
        }
      })
    );
    expect(response.status).toBe(201);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(appendTimelineEvent)).toHaveBeenCalledTimes(1);
  });
});
