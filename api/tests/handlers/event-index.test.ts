import { describe, expect, it, vi } from 'vitest';
import { listRawEventIndexByDateBusinessHandler } from '../../src/functions/event-index';
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
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  };
}

describe('event-index handler', () => {
  it('validates date query', async () => {
    const response = await listRawEventIndexByDateBusinessHandler(
      buildContext(),
      mockHttpRequest({ query: { date: 'bad' } })
    );
    expectValidationErrorIds(response, ['eventIndex.date.invalid']);
  });

  it('returns sorted items by eventAtUtc desc', async () => {
    const ctx = buildContext();
    (ctx.containers.eventIndex.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchNext: vi.fn().mockResolvedValue({
        resources: [{ eventAtUtc: '2026-01-01T00:00:00.000Z' }, { eventAtUtc: '2026-01-02T00:00:00.000Z' }]
      })
    });
    const response = await listRawEventIndexByDateBusinessHandler(
      ctx,
      mockHttpRequest({ query: { date: '2026-01-02' } })
    );
    expect(response.status).toBe(200);
    const items = (response.jsonBody as { items: Array<{ eventAtUtc: string }> }).items;
    expect(items[0].eventAtUtc).toBe('2026-01-02T00:00:00.000Z');
  });
});

