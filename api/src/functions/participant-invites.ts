import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import type { AuthContext, ParticipantContext } from '../shared/handler-context';
import { buildValidationError } from '../shared/errors';
import { readParticipant, readParticipantLink } from '../shared/data/participants';
import { ParticipantInviteDocument } from '../models/participant-invite';
import { UserParticipantLinkDocument } from '../models/participant';
import { composeHttpHandler } from '../shared/http-middleware';
import { getRequestState } from '../shared/request-state';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';

type ParticipantInviteResponse = {
  participantId: string;
  inviteId: string;
  expiresAt: string;
};

type ActiveParticipantInviteResponse = {
  participantId: string;
  inviteId: string | null;
  expiresAt: string | null;
  createdAt: string | null;
};

type AcceptInviteResponse = {
  participantId: string;
  participantDisplayName?: string;
  alreadyLinked: boolean;
};

const PARTICIPANT_PREFIX = 'participant_';
const INVITE_PREFIX = 'invite_';
const INVITE_TTL_DAYS = 7;

export function isParticipantIdValid(participantId?: string | null) {
  return Boolean(participantId && participantId.startsWith(PARTICIPANT_PREFIX));
}

const readActiveParticipantInviteInnerHandler = async (
  ctx: ParticipantContext
): Promise<HttpResponseInit> => {
    if (!isParticipantIdValid(ctx.participantId)) {
      return buildValidationError([
        {
          id: 'participants.id.invalid',
          message: 'Participant id must start with participant_.'
        }
      ]);
    }
    if (ctx.link.role !== 'manager') {
      return { status: 403, jsonBody: { message: 'Invite read requires manager role.' } };
    }

    const nowIso = new Date().toISOString();
    const result = await ctx.containers.participantInvites.items
      .query<ParticipantInviteDocument>(
        {
          query: `SELECT TOP 1 * FROM c
                  WHERE c.participantId = @participantId
                    AND (NOT IS_DEFINED(c.revokedAt))
                    AND (NOT IS_DEFINED(c.consumedAt))
                    AND c.expiresAt >= @now
                  ORDER BY c.createdAt DESC`,
          parameters: [
            { name: '@participantId', value: ctx.participantId },
            { name: '@now', value: nowIso }
          ]
        },
        { partitionKey: ctx.participantId, maxItemCount: 1 }
      )
      .fetchAll();

    const invite = result.resources?.[0];
    const response: ActiveParticipantInviteResponse = {
      participantId: ctx.participantId,
      inviteId: invite?.id ?? null,
      expiresAt: invite?.expiresAt ?? null,
      createdAt: invite?.createdAt ?? null
    };

    return { status: 200, jsonBody: response };
  };

const createParticipantInviteInnerHandler = async (
  ctx: ParticipantContext
): Promise<HttpResponseInit> => {
    if (!isParticipantIdValid(ctx.participantId)) {
      return buildValidationError([
        {
          id: 'participants.id.invalid',
          message: 'Participant id must start with participant_.'
        }
      ]);
    }
    if (ctx.link.role !== 'manager') {
      return { status: 403, jsonBody: { message: 'Invite creation requires manager role.' } };
    }

    const participant = await readParticipant(ctx.containers.participants, ctx.participantId);
    if (!participant) {
      return { status: 404, jsonBody: { message: 'Participant not found.' } };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const existingInvites = await ctx.containers.participantInvites.items
      .query<ParticipantInviteDocument>(
        {
          query:
            'SELECT * FROM c WHERE c.participantId = @participantId AND (NOT IS_DEFINED(c.revokedAt)) AND (NOT IS_DEFINED(c.consumedAt))',
          parameters: [{ name: '@participantId', value: ctx.participantId }]
        },
        { partitionKey: ctx.participantId }
      )
      .fetchAll();

    for (const invite of existingInvites.resources ?? []) {
      await ctx.containers.participantInvites.items.upsert({
        ...invite,
        revokedAt: nowIso,
        revokedByUserId: ctx.user.sub
      });
    }

    const inviteId = `${INVITE_PREFIX}${randomUUID()}`;
    const invite: ParticipantInviteDocument = {
      id: inviteId,
      participantId: ctx.participantId,
      createdAt: nowIso,
      createdByUserId: ctx.user.sub,
      expiresAt
    };

    await ctx.containers.participantInvites.items.create(invite);

    const response: ParticipantInviteResponse = {
      participantId: ctx.participantId,
      inviteId,
      expiresAt
    };

    return { status: 201, jsonBody: response };
  };

export function isInviteIdValid(inviteId?: string | null) {
  return Boolean(inviteId && inviteId.startsWith(INVITE_PREFIX));
}

const acceptParticipantInviteInnerHandler = async (
  ctx: AuthContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
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

    const { resource: invite } = await ctx.containers.participantInvites
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
    const participant = await readParticipant(ctx.containers.participants, participantId);
    if (!participant) {
      return { status: 404, jsonBody: { message: 'Participant not found.' } };
    }

    // Check if user is already linked
    const existingLink = await readParticipantLink(ctx.containers.userParticipantLinks, ctx.user.sub, participantId);
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
      id: `${ctx.user.sub}:${participantId}`,
      userId: ctx.user.sub,
      participantId,
      role: 'manager',
      createdAt: nowIso
    };
    await ctx.containers.userParticipantLinks.items.create(linkDoc);

    // Mark invite as consumed with optimistic concurrency
    try {
      await ctx.containers.participantInvites.item(inviteId, participantId).replace(
        {
          ...invite,
          consumedAt: nowIso,
          consumedByUserId: ctx.user.sub
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
  };

function requireParticipantContext(context: InvocationContext): ParticipantContext {
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

function requireAuthContext(context: InvocationContext): AuthContext {
  const state = getRequestState(context);
  if (!state.containers || !state.user) {
    throw new Error('Auth context was not initialized.');
  }

  return {
    user: state.user,
    containers: state.containers
  };
}

const readActiveParticipantInviteHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (_req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const participantContext = requireParticipantContext(context);
    return readActiveParticipantInviteInnerHandler(participantContext);
  }
});

const createParticipantInviteHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (_req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const participantContext = requireParticipantContext(context);
    return createParticipantInviteInnerHandler(participantContext);
  }
});

const acceptParticipantInviteHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const authContext = requireAuthContext(context);
    return acceptParticipantInviteInnerHandler(authContext, req);
  }
});

app.http('participant-invites-active-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/invites/active',
  handler: readActiveParticipantInviteHandler
});

app.http('participant-invites-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/invites',
  handler: createParticipantInviteHandler
});

app.http('participant-invites-accept', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/invites/{inviteId}/accept',
  handler: acceptParticipantInviteHandler
});

export {
  readActiveParticipantInviteHandler,
  createParticipantInviteHandler,
  acceptParticipantInviteHandler,
  readActiveParticipantInviteInnerHandler,
  createParticipantInviteInnerHandler,
  acceptParticipantInviteInnerHandler
};
