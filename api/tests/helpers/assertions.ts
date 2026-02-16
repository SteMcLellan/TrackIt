import { HttpResponseInit } from '@azure/functions';
import { expect } from 'vitest';

type ErrorBody = {
  errors?: Array<{ id: string }>;
  message?: string;
};

export function expectValidationErrorIds(response: HttpResponseInit, expectedIds: string[]) {
  expect(response.status).toBe(400);
  const ids = ((response.jsonBody as ErrorBody)?.errors ?? []).map((error) => error.id);
  expect(ids).toEqual(expectedIds);
}

export function expectForbidden(response: HttpResponseInit, message: string) {
  expect(response.status).toBe(403);
  expect((response.jsonBody as ErrorBody)?.message).toBe(message);
}

export function expectUnauthorized(response: HttpResponseInit, message?: string) {
  expect(response.status).toBe(401);
  if (message) {
    expect((response.jsonBody as ErrorBody)?.message).toBe(message);
  }
}
