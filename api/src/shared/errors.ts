import { HttpResponseInit } from '@azure/functions';

export type ValidationErrorDetail = {
  id: string;
  message: string;
};

export type ProblemDetailsError = {
  type: string;
  title: string;
  status: number;
  errors: ValidationErrorDetail[];
};

export function buildValidationError(errors: ValidationErrorDetail[]): HttpResponseInit {
  const payload: ProblemDetailsError = {
    type: 'https://example.net/validation-error',
    title: 'Your request is not valid.',
    status: 400,
    errors
  };

  return {
    status: 400,
    headers: { 'content-type': 'application/problem+json' },
    jsonBody: payload
  };
}
