import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { buildMedicationLogListQuery } from '../shared/data/medication-logs';
import { readMedication } from '../shared/data/medications';
import { readParticipantLink } from '../shared/data/participants';
import { MedicationLogDocument } from '../models/medication-log';
import { MedicationDocument } from '../models/medication';
import { projectMedicationLogToEventIndex } from '../shared/timeline/projectors';
import { appendTimelineEvent } from '../shared/timeline/write-through';
import { computeUtcFromLocal, isTimeOnly } from '../shared/validators';

type UpsertMedicationLogRequest = {
  status: 'taken' | 'not_taken';
  logTzOffsetMinutes: number;
  logLocalTime?: string;
  occurrenceKey?: string;
};

type CreateAsNeededMedicationLogRequest = {
  logTzOffsetMinutes: number;
  logLocalTime?: string;
};

const maxPageSize = 100;
const statusOptions = ['taken', 'not_taken'] as const;

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parsePageSize(value?: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, maxPageSize);
}

function parseMedicationIds(value?: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const ids = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return ids.length > 0 ? ids : undefined;
}

function daysBetweenUtc(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const utcB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((utcA - utcB) / (1000 * 60 * 60 * 24));
}

function validateListRequest(startDate: string | null, endDate: string | null): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (!startDate || !isDateOnly(startDate)) {
    errors.push({ id: 'medicationLogs.startDate.invalid', message: 'startDate must be YYYY-MM-DD.' });
  }
  if (!endDate || !isDateOnly(endDate)) {
    errors.push({ id: 'medicationLogs.endDate.invalid', message: 'endDate must be YYYY-MM-DD.' });
  }
  if (startDate && endDate && isDateOnly(startDate) && isDateOnly(endDate) && startDate > endDate) {
    errors.push({ id: 'medicationLogs.dateRange.invalid', message: 'startDate must be before endDate.' });
  }
  return errors;
}

function validateUpsertRequest(
  body: UpsertMedicationLogRequest,
  logLocalDate: string
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (!isDateOnly(logLocalDate)) {
    errors.push({ id: 'medicationLogs.logLocalDate.invalid', message: 'logLocalDate must be YYYY-MM-DD.' });
  }
  if (!statusOptions.includes(body.status)) {
    errors.push({ id: 'medicationLogs.status.invalid', message: 'Status is not valid.' });
  }
  if (
    typeof body.logTzOffsetMinutes !== 'number' ||
    !Number.isFinite(body.logTzOffsetMinutes) ||
    Math.abs(body.logTzOffsetMinutes) > 840
  ) {
    errors.push({
      id: 'medicationLogs.offset.invalid',
      message: 'logTzOffsetMinutes must be a valid timezone offset.'
    });
  }
  if (
    typeof body.logLocalTime !== 'undefined' &&
    (typeof body.logLocalTime !== 'string' || !isTimeOnly(body.logLocalTime.trim()))
  ) {
    errors.push({ id: 'medicationLogs.logLocalTime.invalid', message: 'logLocalTime must be HH:mm.' });
  }
  if (body.status === 'not_taken' && typeof body.logLocalTime !== 'undefined') {
    errors.push({
      id: 'medicationLogs.logLocalTime.notTaken.invalid',
      message: 'logLocalTime is only allowed when status is taken.'
    });
  }
  return errors;
}

function validateAsNeededCreateRequest(
  body: CreateAsNeededMedicationLogRequest,
  logLocalDate: string
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (!isDateOnly(logLocalDate)) {
    errors.push({ id: 'medicationLogs.logLocalDate.invalid', message: 'logLocalDate must be YYYY-MM-DD.' });
  }
  if (
    typeof body.logTzOffsetMinutes !== 'number' ||
    !Number.isFinite(body.logTzOffsetMinutes) ||
    Math.abs(body.logTzOffsetMinutes) > 840
  ) {
    errors.push({
      id: 'medicationLogs.offset.invalid',
      message: 'logTzOffsetMinutes must be a valid timezone offset.'
    });
  }
  if (
    typeof body.logLocalTime !== 'undefined' &&
    (typeof body.logLocalTime !== 'string' || !isTimeOnly(body.logLocalTime.trim()))
  ) {
    errors.push({ id: 'medicationLogs.logLocalTime.invalid', message: 'logLocalTime must be HH:mm.' });
  }
  return errors;
}

function scheduledOccurrenceKeys(frequency: MedicationDocument['frequency']): string[] {
  if (frequency === 'once-daily') {
    return ['dose-1'];
  }
  if (frequency === 'twice-daily') {
    return ['dose-1', 'dose-2'];
  }
  if (frequency === 'three-times-daily') {
    return ['dose-1', 'dose-2', 'dose-3'];
  }
  return [];
}

function validateMedicationWindow(
  medication: MedicationDocument,
  logLocalDate: string
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (logLocalDate < medication.startDateUtc) {
    errors.push({
      id: 'medicationLogs.medicationWindow.invalid',
      message: 'Log date must be on or after medication start date.'
    });
  }
  if (medication.endDateUtc && logLocalDate > medication.endDateUtc) {
    errors.push({
      id: 'medicationLogs.medicationWindow.invalid',
      message: 'Log date must be on or before medication end date.'
    });
  }
  return errors;
}

type ListMedicationLogsResponse = {
  items: MedicationLogDocument[];
  nextToken: string | null;
};

const listMedicationLogsHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    if (!participantId) {
      return buildValidationError([
        { id: 'medicationLogs.participantId.required', message: 'Participant id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const pageSize = parsePageSize(req.query.get('pageSize'));
    const nextToken = req.query.get('nextToken');
    const startDate = req.query.get('startDate');
    const endDate = req.query.get('endDate');
    const medicationIds = parseMedicationIds(req.query.get('medicationIds'));

    const errors = validateListRequest(startDate, endDate);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const query = buildMedicationLogListQuery(participantId, startDate!, endDate!, medicationIds);
    const response = await containers.medicationLogs.items.query<MedicationLogDocument>(query, {
      partitionKey: participantId,
      maxItemCount: pageSize,
      continuationToken: nextToken ?? undefined
    }).fetchNext();

    const payload: ListMedicationLogsResponse = {
      items: response.resources ?? [],
      nextToken: response.continuationToken ?? null
    };
    return { status: 200, jsonBody: payload };
  }
);

const upsertMedicationLogHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const medicationId = req.params.medicationId;
    const logLocalDate = req.params.logLocalDate;
    if (!participantId || !medicationId || !logLocalDate) {
      return buildValidationError([
        { id: 'medicationLogs.participantId.required', message: 'Participant id is required.' },
        { id: 'medicationLogs.medicationId.required', message: 'Medication id is required.' },
        { id: 'medicationLogs.logLocalDate.required', message: 'logLocalDate is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const parsed = await parseJsonBody<UpsertMedicationLogRequest>(req, {
      id: 'medicationLogs.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const errors = validateUpsertRequest(parsed.value, logLocalDate);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const medication = await readMedication(containers.medications, participantId, medicationId);
    if (!medication) {
      return { status: 404, jsonBody: { message: 'Medication not found.' } };
    }

    const now = new Date();
    const logDate = new Date(`${logLocalDate}T00:00:00Z`);
    const daysAgo = daysBetweenUtc(now, logDate);
    if (daysAgo < 0 || daysAgo > 30) {
      return buildValidationError([
        {
          id: 'medicationLogs.dateRange.invalid',
          message: 'Log date must be within the last 30 days.'
        }
      ]);
    }

    const medicationWindowErrors = validateMedicationWindow(medication, logLocalDate);
    if (medicationWindowErrors.length > 0) {
      return buildValidationError(medicationWindowErrors);
    }

    const occurrenceKey = parsed.value.occurrenceKey?.trim();
    if (!occurrenceKey) {
      return buildValidationError([
        {
          id: 'medicationLogs.occurrence.required',
          message: 'occurrenceKey is required.'
        }
      ]);
    }

    if (medication.frequency !== 'as-needed') {
      const allowedOccurrenceKeys = scheduledOccurrenceKeys(medication.frequency);
      if (!allowedOccurrenceKeys.includes(occurrenceKey)) {
        return buildValidationError([
          {
            id: 'medicationLogs.occurrence.invalid',
            message: `occurrenceKey is not valid for frequency ${medication.frequency}.`
          }
        ]);
      }
    }

    const logId = `medlog_${medicationId}_${logLocalDate}_${occurrenceKey}`;
    const existing = await containers.medicationLogs.item(logId, participantId).read<MedicationLogDocument>();
    if (medication.frequency === 'as-needed' && !existing.resource) {
      return { status: 404, jsonBody: { message: 'Medication log not found.' } };
    }

    const base: MedicationLogDocument = existing.resource ?? {
      id: logId,
      participantId,
      medicationId,
      logLocalDate,
      logTzOffsetMinutes: parsed.value.logTzOffsetMinutes,
      occurrenceKey,
      status: parsed.value.status,
      createdAtUtc: now.toISOString(),
      updatedAtUtc: now.toISOString()
    };
    const incomingLogLocalTime = typeof parsed.value.logLocalTime === 'string'
      ? parsed.value.logLocalTime.trim()
      : undefined;
    const logLocalTime = parsed.value.status === 'taken'
      ? (incomingLogLocalTime ?? base.logLocalTime)
      : undefined;
    const takenAtUtc = parsed.value.status === 'taken'
      ? (logLocalTime
        ? computeUtcFromLocal(logLocalDate, logLocalTime, parsed.value.logTzOffsetMinutes)
        : base.takenAtUtc)
      : undefined;

    const updated: MedicationLogDocument = {
      ...base,
      logTzOffsetMinutes: parsed.value.logTzOffsetMinutes,
      logLocalTime,
      takenAtUtc,
      occurrenceKey,
      status: parsed.value.status,
      updatedAtUtc: now.toISOString()
    };

    await containers.medicationLogs.items.upsert(updated);
    await appendTimelineEvent(
      containers.eventIndex,
      projectMedicationLogToEventIndex(updated, medication)
    );

    return { status: 200, jsonBody: updated };
  }
);

const createAsNeededMedicationLogHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const medicationId = req.params.medicationId;
    const logLocalDate = req.params.logLocalDate;
    if (!participantId || !medicationId || !logLocalDate) {
      return buildValidationError([
        { id: 'medicationLogs.participantId.required', message: 'Participant id is required.' },
        { id: 'medicationLogs.medicationId.required', message: 'Medication id is required.' },
        { id: 'medicationLogs.logLocalDate.required', message: 'logLocalDate is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const parsed = await parseJsonBody<CreateAsNeededMedicationLogRequest>(req, {
      id: 'medicationLogs.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const errors = validateAsNeededCreateRequest(parsed.value, logLocalDate);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const medication = await readMedication(containers.medications, participantId, medicationId);
    if (!medication) {
      return { status: 404, jsonBody: { message: 'Medication not found.' } };
    }

    if (medication.frequency !== 'as-needed') {
      return buildValidationError([
        {
          id: 'medicationLogs.frequency.route.invalid',
          message: 'This endpoint only supports as-needed medications.'
        }
      ]);
    }

    const now = new Date();
    const logDate = new Date(`${logLocalDate}T00:00:00Z`);
    const daysAgo = daysBetweenUtc(now, logDate);
    if (daysAgo < 0 || daysAgo > 30) {
      return buildValidationError([
        {
          id: 'medicationLogs.dateRange.invalid',
          message: 'Log date must be within the last 30 days.'
        }
      ]);
    }

    const medicationWindowErrors = validateMedicationWindow(medication, logLocalDate);
    if (medicationWindowErrors.length > 0) {
      return buildValidationError(medicationWindowErrors);
    }

    const timestamp = Date.now();
    const occurrenceKey = `as-needed-${timestamp}-${randomUUID().slice(0, 8)}`;
    const nowIso = now.toISOString();
    const logLocalTime = typeof parsed.value.logLocalTime === 'string'
      ? parsed.value.logLocalTime.trim()
      : undefined;
    const created: MedicationLogDocument = {
      id: `medlog_${medicationId}_${logLocalDate}_${occurrenceKey}`,
      participantId,
      medicationId,
      logLocalDate,
      logLocalTime,
      logTzOffsetMinutes: parsed.value.logTzOffsetMinutes,
      takenAtUtc: logLocalTime
        ? computeUtcFromLocal(logLocalDate, logLocalTime, parsed.value.logTzOffsetMinutes)
        : undefined,
      occurrenceKey,
      status: 'taken',
      createdAtUtc: nowIso,
      updatedAtUtc: nowIso
    };

    await containers.medicationLogs.items.create(created);
    await appendTimelineEvent(
      containers.eventIndex,
      projectMedicationLogToEventIndex(created, medication)
    );

    return { status: 201, jsonBody: created };
  }
);

app.http('medication-logs-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medication-logs',
  handler: listMedicationLogsHandler
});

app.http('medication-logs-upsert', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}',
  handler: upsertMedicationLogHandler
});

app.http('medication-logs-as-needed-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}/as-needed',
  handler: createAsNeededMedicationLogHandler
});

export { listMedicationLogsHandler, upsertMedicationLogHandler, createAsNeededMedicationLogHandler };
