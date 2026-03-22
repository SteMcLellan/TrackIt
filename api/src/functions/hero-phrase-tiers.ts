import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import type { AuthContext } from '../shared/handler-context';
import { bindBusinessHandler, resolveAuthContext } from '../shared/endpoint-template';
import { composeHttpHandler } from '../shared/http-middleware';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { readHeroPhraseTiers } from '../shared/data/hero-phrase-tiers';

/**
 * Returns the hero phrase tiers document for the insights dashboard.
 */
const heroPhraseTiersBusinessHandler = async (
  ctx: AuthContext,
  _req: HttpRequest
): Promise<HttpResponseInit> => {
  const document = await readHeroPhraseTiers(ctx.containers.heroPhraseTiers);
  if (!document) {
    return { status: 404 };
  }
  return { status: 200, jsonBody: document };
};

const heroPhraseTiers = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware
  ],
  handler: bindBusinessHandler(resolveAuthContext, heroPhraseTiersBusinessHandler)
});

/**
 * Authenticated endpoint for fetching hero phrase tiers.
 */
app.http('hero-phrase-tiers-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'hero-phrase-tiers',
  handler: heroPhraseTiers
});

export { heroPhraseTiers, heroPhraseTiersBusinessHandler };
