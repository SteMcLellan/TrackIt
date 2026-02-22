import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import type { ParticipantContext } from '../shared/handler-context';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { readMedication } from '../shared/data/medications';
import { IntervalSchedule, MedicationDocument, MedicationFrequency } from '../models/medication';
import { projectMedicationToEventIndex } from '../shared/timeline/projectors';
import { appendTimelineEvent } from '../shared/timeline/write-through';
import { bindBusinessHandler, resolveParticipantContext } from '../shared/endpoint-template';
import { composeHttpHandler } from '../shared/http-middleware';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';

type IntervalScheduleRequest = {
  intervalDays: number;
  anchorDateLocal?: string | null;
  anchorPolicy?: string;
};

type UpdateMedicationRequest = Partial<{
  name: string;
  dosageText: string;
  frequency: string;
  intervalSchedule: IntervalScheduleRequest | null;
  startDateUtc: string;
  endDateUtc: string | null;
  notes: string | null;
  archivedAtUtc: string | null;
}>;

const frequencyOptions = [
  'once-daily',
  'twice-daily',
  'three-times-daily',
  'interval-days',
  'as-needed'
] as const satisfies MedicationFrequency[];

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isDateOnly(value: string): boolean {
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

function isNullableDateOnly(value: unknown): value is string | null | undefined {
  if (typeof value === 'undefined' || value === null) {
    return true;
  }
  return typeof value === 'string' && isDateOnly(value);
}

function isNullableUtcIso(value: unknown): value is string | null | undefined {
  if (typeof value === 'undefined' || value === null) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  if (!value.endsWith('Z')) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function hasLegacyFrequencyTextField(value: unknown): boolean {
  return typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'frequencyText');
}

function normalizeIntervalSchedule(value: unknown): IntervalSchedule | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as {
    intervalDays?: unknown;
    anchorDateLocal?: unknown;
    anchorPolicy?: unknown;
  };

  if (
    typeof candidate.intervalDays !== 'number' ||
    !Number.isInteger(candidate.intervalDays) ||
    candidate.intervalDays < 2 ||
    candidate.intervalDays > 30
  ) {
    return null;
  }

  let anchorDateLocal: string | null = null;
  if (typeof candidate.anchorDateLocal === 'string') {
    if (!isDateOnly(candidate.anchorDateLocal)) {
      return null;
    }
    anchorDateLocal = candidate.anchorDateLocal;
  } else if (candidate.anchorDateLocal !== null && typeof candidate.anchorDateLocal !== 'undefined') {
    return null;
  }

  const anchorPolicy = candidate.anchorPolicy ?? 'reset-on-taken';
  if (anchorPolicy !== 'reset-on-taken') {
    return null;
  }

  return {
    intervalDays: candidate.intervalDays,
    anchorDateLocal,
    anchorPolicy: 'reset-on-taken'
  };
}

export function validateUpdateRequest(body: UpdateMedicationRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  const frequency = typeof body.frequency === 'string' ? body.frequency.trim() : undefined;
  const hasIntervalSchedule = Object.prototype.hasOwnProperty.call(body, 'intervalSchedule');
  const normalizedIntervalSchedule = hasIntervalSchedule
    ? normalizeIntervalSchedule(body.intervalSchedule)
    : undefined;

  if (typeof body.name !== 'undefined' && !isNonEmpty(body.name)) {
    errors.push({ id: 'medications.name.required', message: 'Name is required.' });
  }
  if (typeof body.dosageText !== 'undefined' && !isNonEmpty(body.dosageText)) {
    errors.push({ id: 'medications.dosage.required', message: 'Dosage is required.' });
  }
  if (typeof frequency !== 'undefined' && !isNonEmpty(frequency)) {
    errors.push({ id: 'medications.frequency.required', message: 'Frequency is required.' });
  } else if (
    typeof frequency !== 'undefined' &&
    isNonEmpty(frequency) &&
    !frequencyOptions.includes(frequency as MedicationFrequency)
  ) {
    errors.push({ id: 'medications.frequency.invalid', message: 'Frequency is not valid.' });
  }
  if (typeof body.startDateUtc !== 'undefined' && !isDateOnly(body.startDateUtc)) {
    errors.push({ id: 'medications.startDate.invalid', message: 'Start date must be YYYY-MM-DD.' });
  }
  if (!isNullableDateOnly(body.endDateUtc)) {
    errors.push({ id: 'medications.endDate.invalid', message: 'End date must be YYYY-MM-DD.' });
  }
  if (!isNullableUtcIso(body.archivedAtUtc)) {
    errors.push({ id: 'medications.archivedAt.invalid', message: 'Archive time must be a UTC ISO string.' });
  }
  if (hasIntervalSchedule && !normalizedIntervalSchedule) {
    errors.push({
      id: 'medications.intervalSchedule.invalid',
      message: 'intervalSchedule is invalid.'
    });
  }

  return errors;
}

const updateMedicationBusinessHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    const medicationId = req.params.medicationId;
    if (!medicationId) {
      return buildValidationError([
        { id: 'medications.medicationId.required', message: 'Medication id is required.' }
      ]);
    }

    const parsed = await parseJsonBody<UpdateMedicationRequest>(req, {
      id: 'medications.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    if (hasLegacyFrequencyTextField(parsed.value)) {
      return buildValidationError([
        {
          id: 'medications.frequencyText.unsupported',
          message: 'frequencyText is no longer supported. Use frequency.'
        }
      ]);
    }

    const errors = validateUpdateRequest(parsed.value);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const existing = await readMedication(ctx.containers.medications, ctx.participantId, medicationId);
    if (!existing) {
      return { status: 404, jsonBody: { message: 'Medication not found.' } };
    }

    const nextFrequency =
      typeof parsed.value.frequency === 'string'
        ? parsed.value.frequency.trim() as MedicationFrequency
        : existing.frequency;
    const hasIntervalScheduleInPayload = Object.prototype.hasOwnProperty.call(parsed.value, 'intervalSchedule');
    const payloadIntervalSchedule = hasIntervalScheduleInPayload
      ? normalizeIntervalSchedule(parsed.value.intervalSchedule)
      : undefined;
    const effectiveIntervalSchedule =
      nextFrequency === 'interval-days'
        ? (hasIntervalScheduleInPayload ? payloadIntervalSchedule : existing.intervalSchedule ?? null)
        : null;

    if (nextFrequency === 'interval-days' && !effectiveIntervalSchedule) {
      return buildValidationError([
        {
          id: 'medications.intervalSchedule.required',
          message: 'intervalSchedule is required when frequency is interval-days.'
        }
      ]);
    }
    if (nextFrequency !== 'interval-days' && hasIntervalScheduleInPayload) {
      return buildValidationError([
        {
          id: 'medications.intervalSchedule.invalid',
          message: 'intervalSchedule is only allowed when frequency is interval-days.'
        }
      ]);
    }

    const nextStartDate = typeof parsed.value.startDateUtc === 'string' ? parsed.value.startDateUtc : existing.startDateUtc;
    const nextEndDate =
      typeof parsed.value.endDateUtc !== 'undefined' ? parsed.value.endDateUtc : existing.endDateUtc;
    if (typeof nextEndDate === 'string' && nextStartDate > nextEndDate) {
      return buildValidationError([
        { id: 'medications.dateRange.invalid', message: 'Start date must be before end date.' }
      ]);
    }

    const updated: MedicationDocument = {
      ...existing,
      name: typeof parsed.value.name === 'string' ? parsed.value.name.trim() : existing.name,
      dosageText:
        typeof parsed.value.dosageText === 'string' ? parsed.value.dosageText.trim() : existing.dosageText,
      frequency: nextFrequency,
      intervalSchedule: nextFrequency === 'interval-days' ? effectiveIntervalSchedule : null,
      startDateUtc: nextStartDate,
      endDateUtc: typeof nextEndDate === 'undefined' ? existing.endDateUtc : nextEndDate,
      notes: typeof parsed.value.notes === 'string' ? parsed.value.notes.trim() : parsed.value.notes ?? existing.notes,
      archivedAtUtc:
        typeof parsed.value.archivedAtUtc === 'undefined' ? existing.archivedAtUtc : parsed.value.archivedAtUtc,
      updatedAtUtc: new Date().toISOString()
    };

    await ctx.containers.medications.items.upsert(updated);
    const action = !existing.archivedAtUtc && updated.archivedAtUtc ? 'archived' : 'updated';
    await appendTimelineEvent(
      ctx.containers.eventIndex,
      projectMedicationToEventIndex(updated, action)
    );

    return { status: 200, jsonBody: updated };
  };

const readMedicationBusinessHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    const medicationId = req.params.medicationId;
    if (!medicationId) {
      return buildValidationError([
        { id: 'medications.medicationId.required', message: 'Medication id is required.' }
      ]);
    }
    const medication = await readMedication(ctx.containers.medications, ctx.participantId, medicationId);
    if (!medication) {
      return { status: 404, jsonBody: { message: 'Medication not found.' } };
    }

    return { status: 200, jsonBody: medication };
  };

const updateMedicationHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, updateMedicationBusinessHandler)
});

const readMedicationHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, readMedicationBusinessHandler)
});

app.http('medication-detail-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medications/{medicationId}',
  handler: readMedicationHandler
});

app.http('medication-detail-patch', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medications/{medicationId}',
  handler: updateMedicationHandler
});

export { readMedicationHandler, updateMedicationHandler, readMedicationBusinessHandler, updateMedicationBusinessHandler };

