import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { withErrorHandling } from '../shared/auth';

const meds: AzureFunction = withErrorHandling(async (context: Context, req: HttpRequest) => {
  const user = authorize(context, req);
  if (req.method === 'GET') {
    context.res = { status: 200, body: { items: [], sub: user.sub } };
    return;
  }

  context.res = { status: 201, body: { message: 'Stubbed create/replace meds route', sub: user.sub } };
});

export default meds;
