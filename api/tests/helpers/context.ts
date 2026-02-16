import { InvocationContext } from '@azure/functions';
import { vi } from 'vitest';

export function mockInvocationContext(): InvocationContext {
  return {
    invocationId: 'test-invocation',
    functionName: 'test-function',
    extraInputs: new Map(),
    extraOutputs: new Map(),
    traceContext: {
      traceParent: '',
      traceState: '',
      attributes: {}
    },
    retryContext: undefined,
    options: {},
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  } as unknown as InvocationContext;
}
