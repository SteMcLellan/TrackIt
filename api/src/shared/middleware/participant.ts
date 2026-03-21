import { authorize } from '../authorize';
import { buildCosmos } from '../cosmos';
import { readParticipantLink } from '../data/participants';
import { buildValidationError } from '../errors';
import { HttpMiddleware } from '../http-middleware';
import { getRequestState, setRequestState } from '../request-state';

export const participantMiddleware: HttpMiddleware = async (request, context, next) => {
  const state = getRequestState(context);
  let { containers } = state;
  if (!containers) {
    const built = await buildCosmos();
    containers = built.containers;
  }

  const user = state.user ?? await authorize(context, request);
  const participantId = request.params.participantId;
  if (!participantId) {
    return buildValidationError([
      {
        id: 'participants.participantId.required',
        message: 'Participant id is required.'
      }
    ]);
  }

  const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
  if (!link) {
    return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
  }

  setRequestState(context, {
    containers,
    user,
    participant: {
      id: participantId,
      link
    }
  });

  return next(request, context);
};
