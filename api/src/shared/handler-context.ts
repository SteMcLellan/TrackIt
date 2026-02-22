import { AppJwtPayload } from './auth';
import { CosmosContainers } from './cosmos';
import { UserParticipantLinkDocument } from '../models/participant';

export type AuthContext = {
  user: AppJwtPayload;
  containers: CosmosContainers;
};

export type ParticipantContext = AuthContext & {
  participantId: string;
  link: UserParticipantLinkDocument;
};
