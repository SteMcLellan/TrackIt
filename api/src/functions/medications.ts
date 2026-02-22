import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import type { ParticipantContext } from '../shared/handler-context';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { buildMedicationListQuery } from '../shared/data/medications';
import { IntervalSchedule, MedicationDocument, MedicationFrequency } from '../models/medication';
import { projectMedicationToEventIndex } from '../shared/timeline/projectors';
import { appendTimelineEvent } from '../shared/timeline/write-through';
import { composeHttpHandler } from '../shared/http-middleware';
import { getRequestState } from '../shared/request-state';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';

type IntervalScheduleRequest = {
  intervalDays: number;
  anchorDateLocal?: string | null;
  anchorPolicy?: string;
};

type CreateMedicationRequest = {
  name: string;
  dosageText: string;
  frequency: string;
  intervalSchedule?: IntervalScheduleRequest | null;
  startDateUtc: string; // YYYY-MM-DD
  endDateUtc?: string | null;
  notes?: string | null;
};

const maxPageSize = 100;
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

export function parsePageSize(value?: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, maxPageSize);
}

export function parseIncludeArchived(value?: string | null): boolean {
  return value === 'true' || value === '1';
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

export function validateCreateRequest(body: CreateMedicationRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  const frequency = typeof body.frequency === 'string' ? body.frequency.trim() : '';
  const normalizedIntervalSchedule = typeof body.intervalSchedule === 'undefined'
    ? undefined
    : normalizeIntervalSchedule(body.intervalSchedule);

  if (!isNonEmpty(body.name)) {
    errors.push({ id: 'medications.name.required', message: 'Name is required.' });
  }
  if (!isNonEmpty(body.dosageText)) {
    errors.push({ id: 'medications.dosage.required', message: 'Dosage is required.' });
  }
  if (!isNonEmpty(frequency)) {
    errors.push({ id: 'medications.frequency.required', message: 'Frequency is required.' });
  } else if (!frequencyOptions.includes(frequency as MedicationFrequency)) {
    errors.push({ id: 'medications.frequency.invalid', message: 'Frequency is not valid.' });
  }
  if (!isNonEmpty(body.startDateUtc) || !isDateOnly(body.startDateUtc)) {
    errors.push({ id: 'medications.startDate.invalid', message: 'Start date must be YYYY-MM-DD.' });
  }
  if (!isNullableDateOnly(body.endDateUtc)) {
    errors.push({ id: 'medications.endDate.invalid', message: 'End date must be YYYY-MM-DD.' });
  }
  if (frequency === 'interval-days') {
    if (typeof body.intervalSchedule === 'undefined' || body.intervalSchedule === null) {
      errors.push({
        id: 'medications.intervalSchedule.required',
        message: 'intervalSchedule is required when frequency is interval-days.'
      });
    } else if (!normalizedIntervalSchedule) {
      errors.push({
        id: 'medications.intervalSchedule.invalid',
        message: 'intervalSchedule is invalid.'
      });
    }
  } else if (typeof body.intervalSchedule !== 'undefined') {
    errors.push({
      id: 'medications.intervalSchedule.invalid',
      message: 'intervalSchedule is only allowed when frequency is interval-days.'
    });
  }
  if (
    isDateOnly(body.startDateUtc) &&
    typeof body.endDateUtc === 'string' &&
    isDateOnly(body.endDateUtc) &&
    body.startDateUtc > body.endDateUtc
  ) {
    errors.push({ id: 'medications.dateRange.invalid', message: 'Start date must be before end date.' });
  }

  return errors;
}

type ListMedicationsResponse = {
  items: MedicationDocument[];
  nextToken: string | null;
};

const listMedicationsInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    const pageSize = parsePageSize(req.query.get('pageSize'));
    const nextToken = req.query.get('nextToken');
    const includeArchived = parseIncludeArchived(req.query.get('includeArchived'));
    const query = buildMedicationListQuery(ctx.participantId, includeArchived);

    const response = await ctx.containers.medications.items.query<MedicationDocument>(query, {
      partitionKey: ctx.participantId,
      maxItemCount: pageSize,
      continuationToken: nextToken ?? undefined
    }).fetchNext();

    const payload: ListMedicationsResponse = {
      items: response.resources ?? [],
      nextToken: response.continuationToken ?? null
    };
    return { status: 200, jsonBody: payload };
  };

const createMedicationInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
    const parsed = await parseJsonBody<CreateMedicationRequest>(req, {
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

    const errors = validateCreateRequest(parsed.value);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const now = new Date().toISOString();
    const frequency = parsed.value.frequency.trim() as MedicationFrequency;
    const intervalSchedule = frequency === 'interval-days'
      ? normalizeIntervalSchedule(parsed.value.intervalSchedule)
      : null;
    const medication: MedicationDocument = {
      id: `med_${randomUUID()}`,
      participantId: ctx.participantId,
      name: parsed.value.name.trim(),
      dosageText: parsed.value.dosageText.trim(),
      frequency,
      intervalSchedule,
      startDateUtc: parsed.value.startDateUtc,
      endDateUtc: parsed.value.endDateUtc ?? null,
      notes: typeof parsed.value.notes === 'string' ? parsed.value.notes.trim() : null,
      archivedAtUtc: null,
      createdAtUtc: now,
      updatedAtUtc: now
    };

    await ctx.containers.medications.items.create(medication);
    await appendTimelineEvent(
      ctx.containers.eventIndex,
      projectMedicationToEventIndex(medication, 'created')
    );

    return { status: 201, jsonBody: medication };
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

const listMedicationsHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const participantContext = requireParticipantContext(context);
    return listMedicationsInnerHandler(participantContext, req);
  }
});

const createMedicationHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const participantContext = requireParticipantContext(context);
    return createMedicationInnerHandler(participantContext, req);
  }
});

app.http('medications-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medications',
  handler: listMedicationsHandler
});

app.http('medications-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/medications',
  handler: createMedicationHandler
});

export { listMedicationsHandler, createMedicationHandler, listMedicationsInnerHandler, createMedicationInnerHandler };
