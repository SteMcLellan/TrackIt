import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { withErrorHandling } from '../shared/auth';

const meds = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const user = authorize(context, req);
  if (req.method === 'GET') {
    return { status: 200, jsonBody: { items: [], sub: user.sub } };
  }

  return { status: 201, jsonBody: { message: 'Stubbed create/replace meds route', sub: user.sub } };
});

export default meds;
