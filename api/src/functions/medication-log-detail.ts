import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError } from '../shared/errors';
import { readMedicationLog } from '../shared/data/medication-logs';
import { readParticipantLink } from '../shared/data/participants';

const readMedicationLogHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const logId = req.params.logId;
    if (!participantId || !logId) {
      return buildValidationError([
        { id: 'medicationLogs.participantId.required', message: 'Participant id is required.' },
        { id: 'medicationLogs.logId.required', message: 'Log id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const log = await readMedicationLog(containers.medicationLogs, participantId, logId);
    if (!log) {
      return { status: 404, jsonBody: { message: 'Medication log not found.' } };
    }

    return { status: 200, jsonBody: log };
  }
);

app.http('medication-log-detail-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medication-logs/{logId}',
  handler: readMedicationLogHandler
});

export { readMedicationLogHandler };
