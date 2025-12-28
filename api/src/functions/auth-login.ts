import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { buildConfig, signAppJwt, verifyGoogleIdToken, withErrorHandling } from '../shared/auth';
import { buildCosmos, upsertUser } from '../shared/cosmos';
import { UserDocument } from '../models/user';

const httpTrigger: AzureFunction = withErrorHandling(async (context: Context, req: HttpRequest) => {
  const idToken = req.headers['authorization']?.replace('Bearer ', '') || '';
  if (!idToken) {
    context.res = { status: 401, body: { message: 'Missing Google ID token' } };
    return;
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

  context.res = {
    status: 200,
    body: {
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
