import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { withErrorHandling } from '../shared/auth';

const rubi: AzureFunction = withErrorHandling(async (context: Context, req: HttpRequest) => {
  const user = authorize(context, req);
  if (req.method === 'GET') {
    context.res = { status: 200, body: { items: [], sub: user.sub } };
    return;
  }

  context.res = { status: 201, body: { message: 'Stubbed RUBI endpoint', sub: user.sub } };
});

export default rubi;
