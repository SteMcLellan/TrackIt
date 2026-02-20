import { requireAdmin } from '../admin';
import { authorize } from '../authorize';
import { HttpMiddleware } from '../http-middleware';
import { getRequestState, setRequestState } from '../request-state';

export const adminGuardMiddleware: HttpMiddleware = async (request, context, next) => {
  const state = getRequestState(context);
  const user = state.user ?? authorize(context, request);
  const adminError = requireAdmin(user);
  if (adminError) {
    return adminError;
  }

  setRequestState(context, { user });
  return next(request, context);
};
