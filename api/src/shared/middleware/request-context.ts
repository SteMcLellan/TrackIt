import { buildCosmos } from '../cosmos';
import { HttpMiddleware } from '../http-middleware';
import { getRequestState, setRequestState } from '../request-state';

export const requestContextMiddleware: HttpMiddleware = async (request, context, next) => {
  let { containers } = getRequestState(context);
  if (!containers) {
    const built = await buildCosmos();
    containers = built.containers;
    setRequestState(context, { containers });
  }

  return next(request, context);
};
