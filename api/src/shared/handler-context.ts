import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withErrorHandling, AppJwtPayload } from './auth';
import { authorize } from './authorize';
import { buildCosmos, CosmosContainers } from './cosmos';
import { buildValidationError } from './errors';
import { readParticipantLink } from './data/participants';
import { UserParticipantLinkDocument } from '../models/participant';

export type AuthContext = {
  user: AppJwtPayload;
  containers: CosmosContainers;
};

export type ParticipantContext = AuthContext & {
  participantId: string;
  link: UserParticipantLinkDocument;
};

type AuthContextHandler = (
  ctx: AuthContext,
  req: HttpRequest,
  invocation: InvocationContext
) => Promise<HttpResponseInit>;

type ParticipantContextHandler = (
  ctx: ParticipantContext,
  req: HttpRequest,
  invocation: InvocationContext
) => Promise<HttpResponseInit>;

export type ParticipantContextOptions = {
  missingParticipantErrorId: string;
  missingParticipantErrorMessage?: string;
  participantParamName?: string;
};

export function withAuthContext(handler: AuthContextHandler) {
  return withErrorHandling(async (req: HttpRequest, context: InvocationContext) => {
    const user = authorize(context, req);
    const { containers } = await buildCosmos();
    return handler({ user, containers }, req, context);
  });
}

export function withParticipantContext(options: ParticipantContextOptions, handler: ParticipantContextHandler) {
  const participantParamName = options.participantParamName ?? 'participantId';
  const missingParticipantErrorMessage = options.missingParticipantErrorMessage ?? 'Participant id is required.';

  return withErrorHandling(async (req: HttpRequest, context: InvocationContext) => {
    const user = authorize(context, req);
    const participantId = req.params[participantParamName];
    if (!participantId) {
      return buildValidationError([
        {
          id: options.missingParticipantErrorId,
          message: missingParticipantErrorMessage
        }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    return handler({ user, containers, participantId, link }, req, context);
  });
}
