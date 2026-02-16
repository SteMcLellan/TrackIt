import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { withParticipantContext, ParticipantContext } from '../shared/handler-context';
import { buildValidationError } from '../shared/errors';
import { readMedicationLog } from '../shared/data/medication-logs';
import { readMedication } from '../shared/data/medications';
import { projectMedicationLogToEventIndex } from '../shared/timeline/projectors';
import { appendTimelineEvent } from '../shared/timeline/write-through';

const readMedicationLogInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    const logId = req.params.logId;
    if (!logId) {
      return buildValidationError([
        { id: 'medicationLogs.logId.required', message: 'Log id is required.' }
      ]);
    }
    const log = await readMedicationLog(ctx.containers.medicationLogs, ctx.participantId, logId);
    if (!log) {
      return { status: 404, jsonBody: { message: 'Medication log not found.' } };
    }

    return { status: 200, jsonBody: log };
  };

const deleteMedicationLogInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    const logId = req.params.logId;
    if (!logId) {
      return buildValidationError([
        { id: 'medicationLogs.logId.required', message: 'Log id is required.' }
      ]);
    }
    const log = await readMedicationLog(ctx.containers.medicationLogs, ctx.participantId, logId);
    if (!log) {
      return { status: 404, jsonBody: { message: 'Medication log not found.' } };
    }

    await ctx.containers.medicationLogs.item(logId, ctx.participantId).delete();

    const medication = await readMedication(ctx.containers.medications, ctx.participantId, log.medicationId);
    await appendTimelineEvent(
      ctx.containers.eventIndex,
      projectMedicationLogToEventIndex(log, medication ?? undefined, 'delete')
    );

    return { status: 204 };
  };

const readMedicationLogHandler = withParticipantContext(
  {
    missingParticipantErrorId: 'medicationLogs.participantId.required'
  },
  readMedicationLogInnerHandler
);

const deleteMedicationLogHandler = withParticipantContext(
  {
    missingParticipantErrorId: 'medicationLogs.participantId.required'
  },
  deleteMedicationLogInnerHandler
);

app.http('medication-log-detail-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medication-logs/{logId}',
  handler: readMedicationLogHandler
});

app.http('medication-log-detail-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medication-logs/{logId}',
  handler: deleteMedicationLogHandler
});

export { readMedicationLogHandler, deleteMedicationLogHandler, readMedicationLogInnerHandler, deleteMedicationLogInnerHandler };
