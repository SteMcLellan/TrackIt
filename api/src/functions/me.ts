import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import jwt from 'jsonwebtoken';
import { AppJwtPayload, buildConfig, withErrorHandling } from '../shared/auth';

const httpTrigger: AzureFunction = withErrorHandling(async (context: Context, req: HttpRequest) => {
  const token = req.headers['authorization']?.replace('Bearer ', '') || '';
  if (!token) {
    context.res = { status: 401, body: { message: 'Missing app token' } };
    return;
  }

  const config = buildConfig();
  const payload = jwt.verify(token, config.jwtSecret, { audience: config.audience }) as AppJwtPayload;
  context.res = { status: 200, body: payload };
});

export default httpTrigger;
