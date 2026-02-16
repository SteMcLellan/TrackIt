import { describe, expect, it } from 'vitest';
import { meInnerHandler } from '../../src/functions/me';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';
import { mockHttpRequest } from '../helpers/http';

describe('meInnerHandler', () => {
  it('returns authenticated payload', async () => {
    const response = await meInnerHandler(
      {
        user: { sub: 'user-1', email: 'user@example.com', iat: 1, exp: 2 },
        containers: createCosmosContainersStub()
      },
      mockHttpRequest()
    );
    expect(response.status).toBe(200);
    expect((response.jsonBody as { sub: string }).sub).toBe('user-1');
  });
});
