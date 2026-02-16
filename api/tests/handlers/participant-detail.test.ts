import { describe, expect, it, vi } from 'vitest';
import { readParticipantInnerHandler, updateParticipantInnerHandler } from '../../src/functions/participant-detail';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';
import { mockHttpRequest } from '../helpers/http';
import { expectValidationErrorIds, expectForbidden } from '../helpers/assertions';

function buildContext(role: 'manager' | 'viewer' = 'manager') {
  return {
    user: { sub: 'user-1', iat: 1, exp: 2 },
    containers: createCosmosContainersStub(),
    participantId: 'participant_1',
    link: {
      id: 'user-1:participant_1',
      userId: 'user-1',
      participantId: 'participant_1',
      role,
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  };
}

describe('participant-detail handlers', () => {
  it('readParticipantInnerHandler returns 404 when participant missing', async () => {
    const ctx = buildContext();
    (ctx.containers.participants.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await readParticipantInnerHandler(ctx);
    expect(response.status).toBe(404);
  });

  it('readParticipantInnerHandler returns participant with caller role', async () => {
    const ctx = buildContext('viewer');
    (ctx.containers.participants.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: {
          id: 'participant_1',
          displayName: 'Kid',
          birthDate: '2020-01-15',
          createdAt: '2026-01-01T00:00:00.000Z',
          createdByUserId: 'user-1'
        }
      })
    });
    const response = await readParticipantInnerHandler(ctx);
    expect(response.status).toBe(200);
    expect((response.jsonBody as { role: string }).role).toBe('viewer');
  });

  it('updateParticipantInnerHandler rejects non-manager caller', async () => {
    const response = await updateParticipantInnerHandler(
      buildContext('viewer'),
      mockHttpRequest({ method: 'PATCH', body: { displayName: 'New' } })
    );
    expectForbidden(response, 'Participant update requires manager role.');
  });

  it('updateParticipantInnerHandler rejects empty update payload', async () => {
    const ctx = buildContext();
    const response = await updateParticipantInnerHandler(ctx, mockHttpRequest({ method: 'PATCH', body: {} }));
    expectValidationErrorIds(response, ['participants.update.empty']);
  });

  it('updateParticipantInnerHandler validates future birthDate', async () => {
    const ctx = buildContext();
    const response = await updateParticipantInnerHandler(
      ctx,
      mockHttpRequest({ method: 'PATCH', body: { birthDate: '2999-01-01' } })
    );
    expectValidationErrorIds(response, ['participants.birthDate.future']);
  });

  it('updateParticipantInnerHandler returns 404 when participant missing', async () => {
    const ctx = buildContext();
    (ctx.containers.participants.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await updateParticipantInnerHandler(
      ctx,
      mockHttpRequest({ method: 'PATCH', body: { displayName: 'New' } })
    );
    expect(response.status).toBe(404);
  });

  it('updateParticipantInnerHandler upserts and returns normalized payload', async () => {
    const ctx = buildContext();
    (ctx.containers.participants.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: {
          id: 'participant_1',
          displayName: 'Kid',
          birthDate: '2020-01-15',
          ageYears: 5,
          createdAt: '2026-01-01T00:00:00.000Z',
          createdByUserId: 'user-1'
        }
      })
    });
    const upsertSpy = ctx.containers.participants.items.upsert as unknown as ReturnType<typeof vi.fn>;
    const response = await updateParticipantInnerHandler(
      ctx,
      mockHttpRequest({ method: 'PATCH', body: { displayName: ' New Name ' } })
    );
    expect(response.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect((response.jsonBody as { displayName?: string }).displayName).toBe('New Name');
  });
});
