import { describe, expect, it, vi } from 'vitest';
import { listParticipantMembersBusinessHandler, revokeParticipantMemberBusinessHandler } from '../../src/functions/participant-members';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';
import { mockHttpRequest } from '../helpers/http';
import { expectForbidden, expectValidationErrorIds } from '../helpers/assertions';

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

describe('participant-members handlers', () => {
  it('listParticipantMembersBusinessHandler validates participant id prefix', async () => {
    const ctx = { ...buildContext(), participantId: 'bad_id' };
    const response = await listParticipantMembersBusinessHandler(ctx);
    expectValidationErrorIds(response, ['participants.id.invalid']);
  });

  it('listParticipantMembersBusinessHandler requires manager role', async () => {
    const response = await listParticipantMembersBusinessHandler(buildContext('viewer'));
    expectForbidden(response, 'Listing members requires manager role.');
  });

  it('listParticipantMembersBusinessHandler returns sorted members', async () => {
    const ctx = buildContext();
    (ctx.containers.userParticipantLinks.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({
        resources: [
          { userId: 'user-2', role: 'viewer', createdAt: '2026-01-02T00:00:00.000Z' },
          { userId: 'user-1', role: 'manager', createdAt: '2026-01-01T00:00:00.000Z' }
        ]
      })
    });
    (ctx.containers.users.item as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ read: vi.fn().mockResolvedValue({ resource: { name: 'Zed' } }) })
      .mockReturnValueOnce({ read: vi.fn().mockResolvedValue({ resource: { name: 'Amy' } }) });
    const response = await listParticipantMembersBusinessHandler(ctx);
    expect(response.status).toBe(200);
    const items = (response.jsonBody as { items: Array<{ userId: string }> }).items;
    expect(items[0].userId).toBe('user-1');
  });

  it('revokeParticipantMemberBusinessHandler requires userId', async () => {
    const response = await revokeParticipantMemberBusinessHandler(buildContext(), mockHttpRequest({ params: {} }));
    expectValidationErrorIds(response, ['members.userId.required']);
  });

  it('revokeParticipantMemberBusinessHandler requires manager role', async () => {
    const response = await revokeParticipantMemberBusinessHandler(
      buildContext('viewer'),
      mockHttpRequest({ params: { userId: 'user-2' } })
    );
    expectForbidden(response, 'Revoking members requires manager role.');
  });

  it('revokeParticipantMemberBusinessHandler blocks self-removal', async () => {
    const response = await revokeParticipantMemberBusinessHandler(
      buildContext(),
      mockHttpRequest({ params: { userId: 'user-1' } })
    );
    expect(response.status).toBe(400);
  });

  it('revokeParticipantMemberBusinessHandler returns 404 when target missing', async () => {
    const ctx = buildContext();
    (ctx.containers.userParticipantLinks.items.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchNext: vi.fn().mockResolvedValue({ resources: [] })
    });
    const response = await revokeParticipantMemberBusinessHandler(
      ctx,
      mockHttpRequest({ params: { userId: 'user-2' } })
    );
    expect(response.status).toBe(404);
  });

  it('revokeParticipantMemberBusinessHandler prevents removing last manager', async () => {
    const ctx = buildContext();
    (ctx.containers.userParticipantLinks.items.query as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        fetchNext: vi.fn().mockResolvedValue({
          resources: [{ userId: 'user-2', participantId: 'participant_1', role: 'manager' }]
        })
      })
      .mockReturnValueOnce({
        fetchAll: vi.fn().mockResolvedValue({ resources: [1] })
      });
    const response = await revokeParticipantMemberBusinessHandler(
      ctx,
      mockHttpRequest({ params: { userId: 'user-2' } })
    );
    expect(response.status).toBe(409);
  });

  it('revokeParticipantMemberBusinessHandler deletes member link', async () => {
    const ctx = buildContext();
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    (ctx.containers.userParticipantLinks.items.query as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        fetchNext: vi.fn().mockResolvedValue({
          resources: [{ userId: 'user-2', participantId: 'participant_1', role: 'viewer' }]
        })
      });
    (ctx.containers.userParticipantLinks.item as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      delete: deleteSpy
    });

    const response = await revokeParticipantMemberBusinessHandler(
      ctx,
      mockHttpRequest({ params: { userId: 'user-2' } })
    );
    expect(response.status).toBe(204);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});

