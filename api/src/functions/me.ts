import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import jwt from 'jsonwebtoken';
import { AppJwtPayload, buildConfig, withErrorHandling } from '../shared/auth';

const httpTrigger = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) {
    return { status: 401, jsonBody: { message: 'Missing app token' } };
  }

  const config = buildConfig();
  const payload = jwt.verify(token, config.jwtSecret, { audience: config.audience }) as AppJwtPayload;
  return { status: 200, jsonBody: payload };
});

export default httpTrigger;
