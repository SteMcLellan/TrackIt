import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { buildConfig, signAppJwt, verifyGoogleIdToken, withErrorHandling } from '../shared/auth';
import { buildCosmos, upsertUser } from '../shared/cosmos';
import { UserDocument } from '../models/user';

const httpTrigger = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const idToken = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!idToken) {
    return { status: 401, jsonBody: { message: 'Missing Google ID token' } };
  }

  const config = buildConfig();
  const googleClaims = await verifyGoogleIdToken(idToken, config);
  const { containers } = buildCosmos();
  const user: UserDocument = {
    sub: googleClaims.sub as string,
    email: googleClaims.email as string,
    name: (googleClaims.name as string) || '',
    picture: googleClaims.picture as string,
    roles: ['parent'],
    createdAt: '',
    lastLoginAt: ''
  };

  const stored = await upsertUser(containers, user);
  const token = signAppJwt({
    sub: stored.sub,
    email: stored.email,
    name: stored.name,
    picture: stored.picture,
    role: stored.roles?.[0]
  }, config);

  return {
    status: 200,
    jsonBody: {
      sub: stored.sub,
      email: stored.email,
      name: stored.name,
      picture: stored.picture,
      role: stored.roles?.[0] || 'parent',
      token
    }
  };
});

export default httpTrigger;
