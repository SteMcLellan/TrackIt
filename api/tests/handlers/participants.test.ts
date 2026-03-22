import { describe, expect, it, vi } from 'vitest';
import { createParticipantBusinessHandler, listParticipantsBusinessHandler } from '../../src/functions/participants';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';
import { mockHttpRequest } from '../helpers/http';
import { expectValidationErrorIds } from '../helpers/assertions';

describe('participants handlers', () => {
  it('listParticipantsBusinessHandler returns normalized participants with role', async () => {
    const ctx = {
      user: { sub: 'user-1', iat: 1, exp: 2 },
      containers: createCosmosContainersStub()
    };
    const queryFetchNext = vi.fn().mockResolvedValue({
      resources: [{ id: 'user-1:participant_1', userId: 'user-1', participantId: 'participant_1', role: 'manager' }],
      continuationToken: null
    });
    const participantRead = vi.fn().mockResolvedValue({
      resource: {
        id: 'participant_1',
        displayName: 'Kid A',
        birthDate: '2020-01-15',
        createdAtUtc: '2026-01-01T00:00:00.000Z',
        createdByUserId: 'user-1'
      }
    });
    (ctx.containers.userParticipantLinks.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchNext: queryFetchNext
    });
    (ctx.containers.participants.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: participantRead
    });

    const response = await listParticipantsBusinessHandler(ctx, mockHttpRequest({ query: { pageSize: '10' } }));
    expect(response.status).toBe(200);
    const body = response.jsonBody as { items: Array<{ role: string; id: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('participant_1');
    expect(body.items[0].role).toBe('manager');
  });

  it('createParticipantBusinessHandler returns body invalid error', async () => {
    const ctx = {
      user: { sub: 'user-1', iat: 1, exp: 2 },
      containers: createCosmosContainersStub()
    };
    const response = await createParticipantBusinessHandler(
      ctx,
      mockHttpRequest({ method: 'POST', rawBodyString: '{invalid-json' })
    );
    expectValidationErrorIds(response, ['participants.body.invalid']);
  });

  it('createParticipantBusinessHandler returns future birthDate error', async () => {
    const ctx = {
      user: { sub: 'user-1', iat: 1, exp: 2 },
      containers: createCosmosContainersStub()
    };
    const response = await createParticipantBusinessHandler(
      ctx,
      mockHttpRequest({
        method: 'POST',
        body: { displayName: 'Kid', birthDate: '2999-01-01' }
      })
    );
    expectValidationErrorIds(response, ['participants.birthDate.future']);
  });

  it('createParticipantBusinessHandler creates participant and manager link', async () => {
    const ctx = {
      user: { sub: 'user-1', iat: 1, exp: 2 },
      containers: createCosmosContainersStub()
    };
    const participantCreate = ctx.containers.participants.items.create as unknown as ReturnType<typeof vi.fn>;
    const linkCreate = ctx.containers.userParticipantLinks.items.create as unknown as ReturnType<typeof vi.fn>;

    const response = await createParticipantBusinessHandler(
      ctx,
      mockHttpRequest({
        method: 'POST',
        body: { displayName: ' Kid ', birthDate: '2020-01-15' }
      })
    );

    expect(response.status).toBe(201);
    expect(participantCreate).toHaveBeenCalledTimes(1);
    expect(linkCreate).toHaveBeenCalledTimes(1);
    const body = response.jsonBody as { displayName?: string };
    expect(body.displayName).toBe('Kid');
  });
});

