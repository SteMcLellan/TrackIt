import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { withErrorHandling } from '../shared/auth';

const rubi = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const user = authorize(context, req);
  if (req.method === 'GET') {
    return { status: 200, jsonBody: { items: [], sub: user.sub } };
  }

  return { status: 201, jsonBody: { message: 'Stubbed RUBI endpoint', sub: user.sub } };
});

app.http('rubi', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'rubi',
  handler: rubi
});

export { rubi };
