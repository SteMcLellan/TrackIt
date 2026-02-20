import { describe, expect, it, vi } from 'vitest';
import { composeHttpHandler, HttpMiddleware } from '../../src/shared/http-middleware';
import { getRequestState, setRequestState } from '../../src/shared/request-state';
import { mockHttpRequest } from '../helpers/http';
import { mockInvocationContext } from '../helpers/context';

describe('composeHttpHandler', () => {
  it('runs middleware in declared order', async () => {
    const calls: string[] = [];
    const middlewareA: HttpMiddleware = async (request, context, next) => {
      calls.push('a-before');
      const response = await next(request, context);
      calls.push('a-after');
      return response;
    };
    const middlewareB: HttpMiddleware = async (request, context, next) => {
      calls.push('b-before');
      const response = await next(request, context);
      calls.push('b-after');
      return response;
    };

    const handler = composeHttpHandler({
      middlewares: [middlewareA, middlewareB],
      handler: async () => {
        calls.push('handler');
        return { status: 200 };
      }
    });

    const response = await handler(mockHttpRequest(), mockInvocationContext());
    expect(response.status).toBe(200);
    expect(calls).toEqual(['a-before', 'b-before', 'handler', 'b-after', 'a-after']);
  });

  it('supports middleware short-circuiting', async () => {
    const nextSpy = vi.fn();
    const shortCircuit: HttpMiddleware = async () => ({ status: 403 });
    const handler = composeHttpHandler({
      middlewares: [shortCircuit],
      handler: nextSpy
    });

    const response = await handler(mockHttpRequest(), mockInvocationContext());
    expect(response.status).toBe(403);
    expect(nextSpy).not.toHaveBeenCalled();
  });
});

describe('request-state', () => {
  it('returns empty state when unset', () => {
    expect(getRequestState(mockInvocationContext())).toEqual({});
  });

  it('stores invocation-local state and merges patches', () => {
    const contextA = mockInvocationContext();
    const contextB = mockInvocationContext();
    const user = { sub: 'user-1', iat: 1, exp: 2 };

    setRequestState(contextA, { user });
    setRequestState(contextA, { parsedBody: { ok: true } });

    expect(getRequestState(contextA).user?.sub).toBe('user-1');
    expect(getRequestState(contextA).parsedBody).toEqual({ ok: true });
    expect(getRequestState(contextB)).toEqual({});
  });
});
