import { HttpRequest } from '@azure/functions';

type MockHttpRequestInit = {
  method?: string;
  url?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
  rawBodyString?: string;
};

export function mockHttpRequest(init: MockHttpRequestInit = {}): HttpRequest {
  const body = typeof init.rawBodyString === 'string'
    ? { string: init.rawBodyString }
    : typeof init.body === 'undefined'
      ? undefined
      : { string: JSON.stringify(init.body) };

  return new HttpRequest({
    method: init.method ?? 'GET',
    url: init.url ?? 'http://localhost/api/test',
    params: init.params,
    query: init.query,
    headers: init.headers,
    body
  });
}
