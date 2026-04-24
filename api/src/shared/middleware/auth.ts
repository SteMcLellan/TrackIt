import { authorize } from '../authorize';
import { buildConfig, resolveClerkIdentityBySub } from '../auth';
import { buildCosmos, upsertUser } from '../cosmos';
import { HttpMiddleware } from '../http-middleware';
import { getRequestState, setRequestState } from '../request-state';

export const authMiddleware: HttpMiddleware = async (request, context, next) => {
  const state = getRequestState(context);
  let { containers } = state;
  if (!containers) {
    const built = await buildCosmos();
    containers = built.containers;
  }

  const user = state.user ?? await authorize(context, request);
  const identity = await resolveClerkIdentityBySub(user.sub, buildConfig());
  await upsertUser(containers, identity);

  setRequestState(context, { containers, user });

  return next(request, context);
};
