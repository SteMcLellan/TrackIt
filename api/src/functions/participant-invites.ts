import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { randomUUID } from 'crypto';
import type { AuthContext, ParticipantContext } from '../shared/handler-context';
import { buildValidationError } from '../shared/errors';
import { readParticipant, readParticipantLink } from '../shared/data/participants';
import { ParticipantInviteDocument } from '../models/participant-invite';
import { UserParticipantLinkDocument } from '../models/participant';
import { bindBusinessHandler, resolveAuthContext, resolveParticipantContext } from '../shared/endpoint-template';
import { composeHttpHandler } from '../shared/http-middleware';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';

type ParticipantInviteResponse = {
  participantId: string;
  inviteId: string;
  expiresAtUtc: string;
};

type ActiveParticipantInviteResponse = {
  participantId: string;
  inviteId: string | null;
  expiresAtUtc: string | null;
  createdAtUtc: string | null;
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

const readActiveParticipantInviteBusinessHandler = async (
  ctx: ParticipantContext,
  _req: HttpRequest
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
                    AND (NOT IS_DEFINED(c.revokedAtUtc))
                    AND (NOT IS_DEFINED(c.consumedAtUtc))
                    AND c.expiresAtUtc >= @now
                  ORDER BY c.createdAtUtc DESC`,
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
      expiresAtUtc: invite?.expiresAtUtc ?? null,
      createdAtUtc: invite?.createdAtUtc ?? null
    };

    return { status: 200, jsonBody: response };
  };

const createParticipantInviteBusinessHandler = async (
  ctx: ParticipantContext,
  _req: HttpRequest
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

    const existingInvites = await ctx.containers.participantInvites.items
      .query<ParticipantInviteDocument>(
        {
          query:
            'SELECT * FROM c WHERE c.participantId = @participantId AND (NOT IS_DEFINED(c.revokedAtUtc)) AND (NOT IS_DEFINED(c.consumedAtUtc))',
          parameters: [{ name: '@participantId', value: ctx.participantId }]
        },
        { partitionKey: ctx.participantId }
      )
      .fetchAll();

    for (const invite of existingInvites.resources ?? []) {
      await ctx.containers.participantInvites.items.upsert({
        ...invite,
        revokedAtUtc: nowIso,
        revokedByUserId: ctx.user.sub
      });
    }

    const inviteId = `${INVITE_PREFIX}${randomUUID()}`;
    const expiresAtUtc = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const invite: ParticipantInviteDocument = {
      id: inviteId,
      participantId: ctx.participantId,
      createdAtUtc: nowIso,
      createdByUserId: ctx.user.sub,
      expiresAtUtc
    };

    await ctx.containers.participantInvites.items.create(invite);

    const response: ParticipantInviteResponse = {
      participantId: ctx.participantId,
      inviteId,
      expiresAtUtc
    };

    return { status: 201, jsonBody: response };
  };

export function isInviteIdValid(inviteId?: string | null) {
  return Boolean(inviteId && inviteId.startsWith(INVITE_PREFIX));
}

const acceptParticipantInviteBusinessHandler = async (
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
    if (new Date(invite.expiresAtUtc) < now) {
      return { status: 403, jsonBody: { message: 'Invite has expired.' } };
    }
    if (invite.revokedAtUtc) {
      return { status: 403, jsonBody: { message: 'Invite has been revoked.' } };
    }
    if (invite.consumedAtUtc) {
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
      createdAtUtc: nowIso
    };
    await ctx.containers.userParticipantLinks.items.create(linkDoc);

    // Mark invite as consumed with optimistic concurrency
    try {
      await ctx.containers.participantInvites.item(inviteId, participantId).replace(
        {
          ...invite,
          consumedAtUtc: nowIso,
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

const readActiveParticipantInviteHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, readActiveParticipantInviteBusinessHandler)
});

const createParticipantInviteHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, createParticipantInviteBusinessHandler)
});

const acceptParticipantInviteHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware
  ],
  handler: bindBusinessHandler(resolveAuthContext, acceptParticipantInviteBusinessHandler)
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
  readActiveParticipantInviteBusinessHandler,
  createParticipantInviteBusinessHandler,
  acceptParticipantInviteBusinessHandler
};

