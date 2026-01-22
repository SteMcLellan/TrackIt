import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError } from '../shared/errors';
import { readParticipantLink } from '../shared/data/participants';
import { UserParticipantLinkDocument } from '../models/participant';
import { UserDocument } from '../models/user';

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

function isParticipantIdValid(participantId?: string | null) {
  return Boolean(participantId && participantId.startsWith(PARTICIPANT_PREFIX));
}

const listParticipantMembersHandler = withErrorHandling(
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

    // Check caller has manager access
    const callerLink = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!callerLink) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }
    if (callerLink.role !== 'manager') {
      return { status: 403, jsonBody: { message: 'Listing members requires manager role.' } };
    }

    // Query all links for this participant (cross-partition query)
    const linksResult = await containers.userParticipantLinks.items
      .query<UserParticipantLinkDocument>({
        query: 'SELECT * FROM c WHERE c.participantId = @participantId',
        parameters: [{ name: '@participantId', value: participantId }]
      })
      .fetchAll();

    const links = linksResult.resources ?? [];

    // Fetch user details for each member
    const members: ParticipantMemberResponse[] = [];
    for (const link of links) {
      const { resource: userDoc } = await containers.users
        .item(link.userId, link.userId)
        .read<UserDocument>();

      members.push({
        userId: link.userId,
        role: link.role,
        name: userDoc?.name || userDoc?.email || 'Unknown',
        picture: userDoc?.picture,
        isMe: link.userId === user.sub,
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
  }
);

app.http('participant-members-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/members',
  handler: listParticipantMembersHandler
});

const revokeParticipantMemberHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const targetUserId = req.params.userId;

    if (!isParticipantIdValid(participantId)) {
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

    const { containers } = await buildCosmos();

    // Check caller has manager access
    const callerLink = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!callerLink) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }
    if (callerLink.role !== 'manager') {
      return { status: 403, jsonBody: { message: 'Revoking members requires manager role.' } };
    }

    // Disallow removing self (MVP)
    if (targetUserId === user.sub) {
      return { status: 400, jsonBody: { message: 'Cannot remove yourself. Transfer ownership first.' } };
    }

    // Check target user is linked
    const targetLink = await readParticipantLink(containers.userParticipantLinks, targetUserId, participantId);
    if (!targetLink) {
      return { status: 404, jsonBody: { message: 'Member not found.' } };
    }

    // Disallow removing last manager (MVP)
    if (targetLink.role === 'manager') {
      // Count managers for this participant
      const managersResult = await containers.userParticipantLinks.items
        .query<number>({
          query: "SELECT VALUE COUNT(1) FROM c WHERE c.participantId = @participantId AND c.role = 'manager'",
          parameters: [{ name: '@participantId', value: participantId }]
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

    // Delete the link
    const linkId = `${targetUserId}:${participantId}`;
    await containers.userParticipantLinks.item(linkId, targetUserId).delete();

    return { status: 204 };
  }
);

app.http('participant-members-revoke', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/members/{userId}',
  handler: revokeParticipantMemberHandler
});

export { listParticipantMembersHandler, revokeParticipantMemberHandler };
