import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError } from '../shared/errors';
import { readParticipant, readParticipantLink } from '../shared/data/participants';
import { ParticipantInviteDocument } from '../models/participant-invite';
import { UserParticipantLinkDocument } from '../models/participant';

type ParticipantInviteResponse = {
  participantId: string;
  inviteId: string;
  expiresAt: string;
};

type AcceptInviteResponse = {
  participantId: string;
  participantDisplayName?: string;
  alreadyLinked: boolean;
};

const PARTICIPANT_PREFIX = 'participant_';
const INVITE_PREFIX = 'invite_';
const INVITE_TTL_DAYS = 7;

function isParticipantIdValid(participantId?: string | null) {
  return Boolean(participantId && participantId.startsWith(PARTICIPANT_PREFIX));
}

const createParticipantInviteHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;

    if (!isParticipantIdValid(participantId)) {
      return buildValidationError([
        {
          id: 'participants.id.invalid',
          message: 'Participant id must start with participant_.'
        }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }
    if (link.role !== 'manager') {
      return { status: 403, jsonBody: { message: 'Invite creation requires manager role.' } };
    }

    const participant = await readParticipant(containers.participants, participantId);
    if (!participant) {
      return { status: 404, jsonBody: { message: 'Participant not found.' } };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const existingInvites = await containers.participantInvites.items
      .query<ParticipantInviteDocument>(
        {
          query:
            'SELECT * FROM c WHERE c.participantId = @participantId AND (NOT IS_DEFINED(c.revokedAt)) AND (NOT IS_DEFINED(c.consumedAt))',
          parameters: [{ name: '@participantId', value: participantId }]
        },
        { partitionKey: participantId }
      )
      .fetchAll();

    for (const invite of existingInvites.resources ?? []) {
      await containers.participantInvites.items.upsert({
        ...invite,
        revokedAt: nowIso,
        revokedByUserId: user.sub
      });
    }

    const inviteId = `${INVITE_PREFIX}${randomUUID()}`;
    const invite: ParticipantInviteDocument = {
      id: inviteId,
      participantId,
      createdAt: nowIso,
      createdByUserId: user.sub,
      expiresAt
    };

    await containers.participantInvites.items.create(invite);

    const response: ParticipantInviteResponse = {
      participantId,
      inviteId,
      expiresAt
    };

    return { status: 201, jsonBody: response };
  }
);

app.http('participant-invites-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/invites',
  handler: createParticipantInviteHandler
});

function isInviteIdValid(inviteId?: string | null) {
  return Boolean(inviteId && inviteId.startsWith(INVITE_PREFIX));
}

const acceptParticipantInviteHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const inviteId = req.params.inviteId;

    if (!isParticipantIdValid(participantId)) {
      return buildValidationError([
        {
          id: 'participants.id.invalid',
          message: 'Participant id must start with participant_.'
        }
      ]);
    }

    if (!isInviteIdValid(inviteId)) {
      return buildValidationError([
        {
          id: 'invites.id.invalid',
          message: 'Invite id must start with invite_.'
        }
      ]);
    }

    const { containers } = await buildCosmos();

    // Read invite by point read (partition key is participantId)
    const { resource: invite } = await containers.participantInvites
      .item(inviteId, participantId)
      .read<ParticipantInviteDocument>();

    if (!invite) {
      return { status: 404, jsonBody: { message: 'Invite not found.' } };
    }

    // Validate invite is usable
    const now = new Date();
    if (new Date(invite.expiresAt) < now) {
      return { status: 403, jsonBody: { message: 'Invite has expired.' } };
    }
    if (invite.revokedAt) {
      return { status: 403, jsonBody: { message: 'Invite has been revoked.' } };
    }
    if (invite.consumedAt) {
      return { status: 403, jsonBody: { message: 'Invite has already been used.' } };
    }

    // Check if participant exists
    const participant = await readParticipant(containers.participants, participantId);
    if (!participant) {
      return { status: 404, jsonBody: { message: 'Participant not found.' } };
    }

    // Check if user is already linked
    const existingLink = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (existingLink) {
      const response: AcceptInviteResponse = {
        participantId,
        participantDisplayName: participant.displayName,
        alreadyLinked: true
      };
      return { status: 200, jsonBody: response };
    }

    // Create the user-participant link
    const nowIso = now.toISOString();
    const linkDoc: UserParticipantLinkDocument = {
      id: `${user.sub}:${participantId}`,
      userId: user.sub,
      participantId,
      role: 'manager',
      createdAt: nowIso
    };
    await containers.userParticipantLinks.items.create(linkDoc);

    // Mark invite as consumed with optimistic concurrency
    try {
      await containers.participantInvites.item(inviteId, participantId).replace(
        {
          ...invite,
          consumedAt: nowIso,
          consumedByUserId: user.sub
        },
        { accessCondition: { type: 'IfMatch', condition: invite._etag! } }
      );
    } catch (err: unknown) {
      // If ETag mismatch (412), the invite was consumed by another request
      const cosmosErr = err as { code?: number };
      if (cosmosErr.code === 412) {
        return { status: 403, jsonBody: { message: 'Invite has already been used.' } };
      }
      throw err;
    }

    const response: AcceptInviteResponse = {
      participantId,
      participantDisplayName: participant.displayName,
      alreadyLinked: false
    };
    return { status: 200, jsonBody: response };
  }
);

app.http('participant-invites-accept', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/invites/{inviteId}/accept',
  handler: acceptParticipantInviteHandler
});

export { createParticipantInviteHandler, acceptParticipantInviteHandler };
