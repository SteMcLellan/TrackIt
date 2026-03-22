import { describe, expect, it, vi } from 'vitest';
import {
  readActiveParticipantInviteBusinessHandler,
  createParticipantInviteBusinessHandler,
  acceptParticipantInviteBusinessHandler
} from '../../src/functions/participant-invites';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';
import { mockHttpRequest } from '../helpers/http';
import { expectForbidden, expectValidationErrorIds } from '../helpers/assertions';

function buildParticipantContext(role: 'manager' | 'viewer' = 'manager') {
  return {
    user: { sub: 'user-1', iat: 1, exp: 2 },
    containers: createCosmosContainersStub(),
    participantId: 'participant_1',
    link: {
      id: 'user-1:participant_1',
      userId: 'user-1',
      participantId: 'participant_1',
      role,
      createdAtUtc: '2026-01-01T00:00:00.000Z'
    }
  };
}

function buildAuthContext() {
  return {
    user: { sub: 'user-1', iat: 1, exp: 2 },
    containers: createCosmosContainersStub()
  };
}

describe('participant-invites handlers', () => {
  it('readActiveParticipantInviteBusinessHandler validates participant id', async () => {
    const response = await readActiveParticipantInviteBusinessHandler({
      ...buildParticipantContext(),
      participantId: 'bad'
    });
    expectValidationErrorIds(response, ['participants.id.invalid']);
  });

  it('readActiveParticipantInviteBusinessHandler requires manager role', async () => {
    const response = await readActiveParticipantInviteBusinessHandler(buildParticipantContext('viewer'));
    expectForbidden(response, 'Invite read requires manager role.');
  });

  it('readActiveParticipantInviteBusinessHandler returns nullable active invite payload', async () => {
    const ctx = buildParticipantContext();
    (ctx.containers.participantInvites.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [] })
    });
    const response = await readActiveParticipantInviteBusinessHandler(ctx);
    expect(response.status).toBe(200);
    expect((response.jsonBody as { inviteId: string | null }).inviteId).toBeNull();
  });

  it('createParticipantInviteBusinessHandler requires manager role', async () => {
    const response = await createParticipantInviteBusinessHandler(buildParticipantContext('viewer'));
    expectForbidden(response, 'Invite creation requires manager role.');
  });

  it('createParticipantInviteBusinessHandler returns 404 when participant missing', async () => {
    const ctx = buildParticipantContext();
    (ctx.containers.participants.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await createParticipantInviteBusinessHandler(ctx);
    expect(response.status).toBe(404);
  });

  it('createParticipantInviteBusinessHandler revokes active invites and creates one', async () => {
    const ctx = buildParticipantContext();
    (ctx.containers.participants.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: { id: 'participant_1', createdAt: 'x', createdByUserId: 'user-1' } })
    });
    (ctx.containers.participantInvites.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [{ id: 'invite_old', participantId: 'participant_1', createdAtUtc: 'x', createdByUserId: 'user-1', expiresAtUtc: 'z' }]
      })
    });
    const upsertSpy = ctx.containers.participantInvites.items.upsert as unknown as ReturnType<typeof vi.fn>;
    const createSpy = ctx.containers.participantInvites.items.create as unknown as ReturnType<typeof vi.fn>;
    const response = await createParticipantInviteBusinessHandler(ctx);
    expect(response.status).toBe(201);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('acceptParticipantInviteBusinessHandler validates participant id and invite id', async () => {
    const ctx = buildAuthContext();
    const badParticipant = await acceptParticipantInviteBusinessHandler(
      ctx,
      mockHttpRequest({ params: { participantId: 'bad', inviteId: 'invite_x' } })
    );
    expectValidationErrorIds(badParticipant, ['participants.id.invalid']);

    const badInvite = await acceptParticipantInviteBusinessHandler(
      ctx,
      mockHttpRequest({ params: { participantId: 'participant_1', inviteId: 'bad' } })
    );
    expectValidationErrorIds(badInvite, ['invites.id.invalid']);
  });

  it('acceptParticipantInviteBusinessHandler returns 404 when invite missing', async () => {
    const ctx = buildAuthContext();
    (ctx.containers.participantInvites.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null })
    });
    const response = await acceptParticipantInviteBusinessHandler(
      ctx,
      mockHttpRequest({ params: { participantId: 'participant_1', inviteId: 'invite_x' } })
    );
    expect(response.status).toBe(404);
  });

  it('acceptParticipantInviteBusinessHandler handles expired/revoked/consumed', async () => {
    const ctx = buildAuthContext();
    const expiredInvite = {
      id: 'invite_x',
      participantId: 'participant_1',
      expiresAtUtc: '2000-01-01T00:00:00.000Z'
    };
    (ctx.containers.participantInvites.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: expiredInvite })
    });
    const expired = await acceptParticipantInviteBusinessHandler(
      ctx,
      mockHttpRequest({ params: { participantId: 'participant_1', inviteId: 'invite_x' } })
    );
    expect(expired.status).toBe(403);

    (ctx.containers.participantInvites.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: { ...expiredInvite, expiresAtUtc: '2999-01-01T00:00:00.000Z', revokedAtUtc: 'x' } })
    });
    const revoked = await acceptParticipantInviteBusinessHandler(
      ctx,
      mockHttpRequest({ params: { participantId: 'participant_1', inviteId: 'invite_x' } })
    );
    expect(revoked.status).toBe(403);

    (ctx.containers.participantInvites.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: { ...expiredInvite, expiresAtUtc: '2999-01-01T00:00:00.000Z', consumedAtUtc: 'x' } })
    });
    const consumed = await acceptParticipantInviteBusinessHandler(
      ctx,
      mockHttpRequest({ params: { participantId: 'participant_1', inviteId: 'invite_x' } })
    );
    expect(consumed.status).toBe(403);
  });

  it('acceptParticipantInviteBusinessHandler returns alreadyLinked response', async () => {
    const ctx = buildAuthContext();
    (ctx.containers.participantInvites.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: { id: 'invite_x', participantId: 'participant_1', expiresAtUtc: '2999-01-01T00:00:00.000Z', _etag: 'abc' }
      })
    });
    (ctx.containers.participants.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: { id: 'participant_1', displayName: 'Kid', createdAtUtc: 'x', createdByUserId: 'u' } })
    });
    (ctx.containers.userParticipantLinks.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchNext: vi.fn().mockResolvedValue({ resources: [{ userId: 'user-1' }] })
    });
    const response = await acceptParticipantInviteBusinessHandler(
      ctx,
      mockHttpRequest({ params: { participantId: 'participant_1', inviteId: 'invite_x' } })
    );
    expect(response.status).toBe(200);
    expect((response.jsonBody as { alreadyLinked: boolean }).alreadyLinked).toBe(true);
  });

  it('acceptParticipantInviteBusinessHandler creates link and handles etag conflict', async () => {
    const ctx = buildAuthContext();
    const replaceSpy = vi.fn().mockRejectedValue({ code: 412 });
    (ctx.containers.participantInvites.item as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        read: vi.fn().mockResolvedValue({
          resource: { id: 'invite_x', participantId: 'participant_1', expiresAtUtc: '2999-01-01T00:00:00.000Z', _etag: 'abc' }
        })
      })
      .mockReturnValueOnce({
        replace: replaceSpy
      });
    (ctx.containers.participants.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: { id: 'participant_1', displayName: 'Kid', createdAtUtc: 'x', createdByUserId: 'u' } })
    });
    (ctx.containers.userParticipantLinks.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchNext: vi.fn().mockResolvedValue({ resources: [] })
    });

    const response = await acceptParticipantInviteBusinessHandler(
      ctx,
      mockHttpRequest({ params: { participantId: 'participant_1', inviteId: 'invite_x' } })
    );
    expect(response.status).toBe(403);
  });
});

