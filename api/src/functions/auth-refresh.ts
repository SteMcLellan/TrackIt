import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { buildConfig, signAppJwt, verifyGoogleIdToken, withErrorHandling } from '../shared/auth';

const httpTrigger = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const idToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!idToken) {
    return { status: 401, jsonBody: { message: 'Missing Google ID token' } };
  }

  const config = buildConfig();
  const claims = await verifyGoogleIdToken(idToken, config);
  const token = signAppJwt(
    {
      sub: claims.sub as string,
      email: claims.email as string,
      name: claims.name as string,
      picture: claims.picture as string,
      role: 'parent'
    },
    config
  );

  return { status: 200, jsonBody: { token } };
});

export default httpTrigger;
