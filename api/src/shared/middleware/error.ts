import { HttpMiddleware } from '../http-middleware';

export const errorMiddleware: HttpMiddleware = async (request, context, next) => {
  try {
    return await next(request, context);
  } catch (err: unknown) {
    context.error('Error', err);
    const status =
      typeof err === 'object' && err !== null && 'status' in err &&
      typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    return {
      status,
      jsonBody: { message: err instanceof Error ? err.message : 'Internal error' }
    };
  }
};
