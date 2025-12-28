import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { buildConfig, signAppJwt, verifyGoogleIdToken, withErrorHandling } from '../shared/auth';

const httpTrigger: AzureFunction = withErrorHandling(async (context: Context, req: HttpRequest) => {
  const idToken = req.headers['authorization']?.replace('Bearer ', '') || '';
  if (!idToken) {
    context.res = { status: 401, body: { message: 'Missing Google ID token' } };
    return;
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

  context.res = { status: 200, body: { token } };
});

export default httpTrigger;
