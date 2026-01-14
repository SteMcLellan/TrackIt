import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { buildValidationError, ValidationErrorDetail } from './errors';

type ParsedBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: HttpResponseInit };

export async function parseJsonBody<T>(
  req: HttpRequest,
  error: ValidationErrorDetail
): Promise<ParsedBodyResult<T>> {
  try {
    const body = (await req.json()) as T;
    return { ok: true, value: body };
  } catch {
    return {
      ok: false,
      response: buildValidationError([error])
    };
  }
}
