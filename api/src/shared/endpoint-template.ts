import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import type { AuthContext, ParticipantContext } from './handler-context';
import type { CosmosContainers } from './cosmos';
import type { HttpHandler } from './http-middleware';
import { getRequestState } from './request-state';

export type RequestResourcesContext = {
  containers: CosmosContainers;
};

export type BusinessHandler<TContext> = (
  context: TContext,
  request: HttpRequest
) => Promise<HttpResponseInit>;

export type ContextResolver<TContext> = (context: InvocationContext) => TContext;

export function bindBusinessHandler<TContext>(
  resolveContext: ContextResolver<TContext>,
  businessHandler: BusinessHandler<TContext>
): HttpHandler {
  return (request, context) => businessHandler(resolveContext(context), request);
}

export function resolveRequestResourcesContext(context: InvocationContext): RequestResourcesContext {
  const state = getRequestState(context);
  if (!state.containers) {
    throw new Error('Request context was not initialized.');
  }

  return {
    containers: state.containers
  };
}

export function resolveAuthContext(context: InvocationContext): AuthContext {
  const state = getRequestState(context);
  if (!state.containers || !state.user) {
    throw new Error('Auth context was not initialized.');
  }

  return {
    user: state.user,
    containers: state.containers
  };
}

export function resolveParticipantContext(context: InvocationContext): ParticipantContext {
  const state = getRequestState(context);
  if (!state.containers || !state.user || !state.participant) {
    throw new Error('Participant context was not initialized.');
  }

  return {
    user: state.user,
    containers: state.containers,
    participantId: state.participant.id,
    link: state.participant.link
  };
}
