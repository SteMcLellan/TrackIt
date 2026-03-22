import { describe, expect, it, vi } from 'vitest';
import { listTimelineBusinessHandler, timelineContextBusinessHandler } from '../../src/functions/timeline';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';
import { mockHttpRequest } from '../helpers/http';
import { expectValidationErrorIds } from '../helpers/assertions';
import { ParticipantContext } from '../../src/shared/handler-context';

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
      createdAtUtc: '2026-01-01T00:00:00.000Z'
    }
  };
}

describe('timeline handlers', () => {
  it('listTimelineBusinessHandler validates date/cursorDate', async () => {
    const response = await listTimelineBusinessHandler(
      buildContext(),
      mockHttpRequest({ query: { date: 'bad', cursorDate: 'bad' } })
    );
    expectValidationErrorIds(response, ['timeline.date.invalid', 'timeline.cursorDate.invalid']);
  });

  it('listTimelineBusinessHandler returns projected timeline payload', async () => {
    const ctx = buildContext();
    (ctx.containers.eventIndex.items.query as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        fetchNext: vi.fn().mockResolvedValue({ resources: [], continuationToken: null })
      })
      .mockReturnValueOnce({
        fetchNext: vi.fn().mockResolvedValue({ resources: [] })
      });
    const response = await listTimelineBusinessHandler(
      ctx,
      mockHttpRequest({ query: { date: '2026-02-01' } })
    );
    expect(response.status).toBe(200);
    expect((response.jsonBody as { projectionMode: string }).projectionMode).toBe('daily-final-state');
  });

  it('timelineContextBusinessHandler validates required params and source type', async () => {
    const missing = await timelineContextBusinessHandler(buildContext(), mockHttpRequest({ params: {} }));
    expectValidationErrorIds(missing, ['timeline.context.params.required']);

    const invalid = await timelineContextBusinessHandler(
      buildContext(),
      mockHttpRequest({ params: { sourceType: 'bad', sourceId: 'id' } })
    );
    expectValidationErrorIds(invalid, ['timeline.sourceType.invalid']);
  });

  it('timelineContextBusinessHandler returns 404 when anchor missing', async () => {
    const ctx = buildContext();
    (ctx.containers.eventIndex.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchNext: vi.fn().mockResolvedValue({ resources: [] })
    });
    const response = await timelineContextBusinessHandler(
      ctx,
      mockHttpRequest({ params: { sourceType: 'incident', sourceId: 'incident_1' } })
    );
    expect(response.status).toBe(404);
  });

  it('timelineContextBusinessHandler returns anchor and context items', async () => {
    const ctx = buildContext();
    const anchor = { eventAtUtc: '2026-02-01T12:00:00.000Z', sourceType: 'incident', sourceId: 'incident_1' };
    (ctx.containers.eventIndex.items.query as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        fetchNext: vi.fn().mockResolvedValue({ resources: [anchor] })
      })
      .mockReturnValueOnce({
        fetchNext: vi.fn().mockResolvedValue({ resources: [] })
      });
    const response = await timelineContextBusinessHandler(
      ctx,
      mockHttpRequest({ params: { sourceType: 'incident', sourceId: 'incident_1' }, query: { minutes: '30' } })
    );
    expect(response.status).toBe(200);
    expect((response.jsonBody as { minutes: number }).minutes).toBe(30);
  });
});

