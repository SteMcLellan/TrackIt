import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import type { ParticipantContext } from '../shared/handler-context';
import { buildValidationError } from '../shared/errors';
import { readParticipantLink } from '../shared/data/participants';
import { UserParticipantLinkDocument } from '../models/participant';
import { UserDocument } from '../models/user';
import { bindBusinessHandler, resolveParticipantContext } from '../shared/endpoint-template';
import { composeHttpHandler } from '../shared/http-middleware';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';

type ParticipantRole = 'manager' | 'viewer';

type ParticipantMemberResponse = {
  userId: string;
  role: ParticipantRole;
  name: string;
  picture?: string;
  isMe: boolean;
  addedAt: string;
};

type CollectionResponse<T> = {
  items: T[];
  nextToken: string | null;
};

const PARTICIPANT_PREFIX = 'participant_';

export function isParticipantIdValid(participantId?: string | null) {
  return Boolean(participantId && participantId.startsWith(PARTICIPANT_PREFIX));
}

const listParticipantMembersBusinessHandler = async (
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
      return { status: 403, jsonBody: { message: 'Listing members requires manager role.' } };
    }

    const linksResult = await ctx.containers.userParticipantLinks.items
      .query<UserParticipantLinkDocument>({
        query: 'SELECT * FROM c WHERE c.participantId = @participantId',
        parameters: [{ name: '@participantId', value: ctx.participantId }]
      })
      .fetchAll();

    const links = linksResult.resources ?? [];

    // Fetch user details for each member
    const members: ParticipantMemberResponse[] = [];
    for (const link of links) {
      const { resource: userDoc } = await ctx.containers.users
        .item(link.userId, link.userId)
        .read<UserDocument>();

      members.push({
        userId: link.userId,
        role: link.role,
        name: userDoc?.name || userDoc?.email || 'Unknown',
        picture: userDoc?.picture,
        isMe: link.userId === ctx.user.sub,
        addedAt: link.createdAt
      });
    }

    // Sort: current user first, then by name
    members.sort((a, b) => {
      if (a.isMe && !b.isMe) return -1;
      if (!a.isMe && b.isMe) return 1;
      return a.name.localeCompare(b.name);
    });

    const response: CollectionResponse<ParticipantMemberResponse> = {
      items: members,
      nextToken: null
    };

    return { status: 200, jsonBody: response };
  };

const revokeParticipantMemberBusinessHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    const targetUserId = req.params.userId;

    if (!isParticipantIdValid(ctx.participantId)) {
      return buildValidationError([
        {
          id: 'participants.id.invalid',
          message: 'Participant id must start with participant_.'
        }
      ]);
    }

    if (!targetUserId) {
      return buildValidationError([
        {
          id: 'members.userId.required',
          message: 'User id is required.'
        }
      ]);
    }
    if (ctx.link.role !== 'manager') {
      return { status: 403, jsonBody: { message: 'Revoking members requires manager role.' } };
    }

    if (targetUserId === ctx.user.sub) {
      return { status: 400, jsonBody: { message: 'Cannot remove yourself. Transfer ownership first.' } };
    }

    const targetLink = await readParticipantLink(ctx.containers.userParticipantLinks, targetUserId, ctx.participantId);
    if (!targetLink) {
      return { status: 404, jsonBody: { message: 'Member not found.' } };
    }

    if (targetLink.role === 'manager') {
      const managersResult = await ctx.containers.userParticipantLinks.items
        .query<number>({
          query: "SELECT VALUE COUNT(1) FROM c WHERE c.participantId = @participantId AND c.role = 'manager'",
          parameters: [{ name: '@participantId', value: ctx.participantId }]
        })
        .fetchAll();

      const managerCount = managersResult.resources?.[0] ?? 0;
      if (managerCount <= 1) {
        return {
          status: 409,
          jsonBody: { message: 'Cannot remove the last manager. Add another manager first.' }
        };
      }
    }

    const linkId = `${targetUserId}:${ctx.participantId}`;
    await ctx.containers.userParticipantLinks.item(linkId, targetUserId).delete();

    return { status: 204 };
  };

const listParticipantMembersHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, listParticipantMembersBusinessHandler)
});

const revokeParticipantMemberHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, revokeParticipantMemberBusinessHandler)
});

app.http('participant-members-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/members',
  handler: listParticipantMembersHandler
});

app.http('participant-members-revoke', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/members/{userId}',
  handler: revokeParticipantMemberHandler
});

export { listParticipantMembersHandler, revokeParticipantMemberHandler, listParticipantMembersBusinessHandler, revokeParticipantMemberBusinessHandler };

