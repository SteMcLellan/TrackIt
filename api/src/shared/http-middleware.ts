import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export type HttpHandler = (
  request: HttpRequest,
  context: InvocationContext
) => Promise<HttpResponseInit>;

export type HttpMiddleware = (
  request: HttpRequest,
  context: InvocationContext,
  next: HttpHandler
) => Promise<HttpResponseInit>;

export type ComposeOptions = {
  middlewares: HttpMiddleware[];
  handler: HttpHandler;
};

export function composeHttpHandler(options: ComposeOptions): HttpHandler {
  return options.middlewares.reduceRight<HttpHandler>(
    (next, middleware) => (request, context) => middleware(request, context, next),
    options.handler
  );
}
