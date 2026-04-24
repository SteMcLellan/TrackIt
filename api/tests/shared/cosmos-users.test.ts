import { describe, expect, it, vi } from 'vitest';
import { upsertUser } from '../../src/shared/cosmos';

function buildUsersContainer(existing: unknown = null) {
  const read = vi.fn().mockResolvedValue({ resource: existing });
  const item = vi.fn().mockReturnValue({ read });
  const upsert = vi.fn().mockResolvedValue({});

  return {
    container: {
      users: {
        item,
        items: { upsert }
      }
    },
    read,
    item,
    upsert
  };
}

describe('upsertUser', () => {
  it('creates a role-free user projection from Clerk profile data', async () => {
    const { container, upsert } = buildUsersContainer();

    const doc = await upsertUser(container, {
      sub: 'user_1',
      email: 'user@example.com',
      name: 'User One',
      picture: 'https://example.com/user.png'
    });

    expect(doc).toMatchObject({
      id: 'user_1',
      sub: 'user_1',
      email: 'user@example.com',
      name: 'User One',
      picture: 'https://example.com/user.png'
    });
    expect('roles' in doc).toBe(false);
    expect(upsert).toHaveBeenCalledWith(expect.not.objectContaining({ roles: expect.anything() }), {
      preTriggerInclude: [],
      postTriggerInclude: []
    });
  });

  it('preserves existing created timestamp and settings while refreshing profile fields', async () => {
    const { container } = buildUsersContainer({
      id: 'user_1',
      sub: 'user_1',
      email: 'old@example.com',
      name: 'Old Name',
      settings: { reducedMotion: true },
      createdAtUtc: '2026-01-01T00:00:00.000Z',
      lastLoginAtUtc: '2026-01-02T00:00:00.000Z'
    });

    const doc = await upsertUser(container, {
      sub: 'user_1',
      email: 'new@example.com',
      name: 'New Name'
    });

    expect(doc.createdAtUtc).toBe('2026-01-01T00:00:00.000Z');
    expect(doc.settings).toEqual({ reducedMotion: true });
    expect(doc.email).toBe('new@example.com');
    expect(doc.name).toBe('New Name');
    expect(doc.lastLoginAtUtc).not.toBe('2026-01-02T00:00:00.000Z');
  });
});
