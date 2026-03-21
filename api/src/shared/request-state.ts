import { InvocationContext } from '@azure/functions';
import { CosmosContainers } from './cosmos';
import { ResolvedClerkClaims } from './auth';
import { UserParticipantLinkDocument } from '../models/participant';

export type RequestState = {
  containers?: CosmosContainers;
  user?: ResolvedClerkClaims;
  participant?: {
    id: string;
    link: UserParticipantLinkDocument;
  };
  parsedBody?: unknown;
};

const requestStateStore = new WeakMap<InvocationContext, RequestState>();

export function getRequestState(context: InvocationContext): RequestState {
  return requestStateStore.get(context) ?? {};
}

export function setRequestState(context: InvocationContext, patch: Partial<RequestState>): void {
  const previous = requestStateStore.get(context) ?? {};
  requestStateStore.set(context, {
    ...previous,
    ...patch
  });
}
