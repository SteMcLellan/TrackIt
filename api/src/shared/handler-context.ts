import { ResolvedClerkClaims } from './auth';
import { CosmosContainers } from './cosmos';
import { UserParticipantLinkDocument } from '../models/participant';

export type AuthContext = {
  user: ResolvedClerkClaims;
  containers: CosmosContainers;
};

export type ParticipantContext = AuthContext & {
  participantId: string;
  link: UserParticipantLinkDocument;
};
