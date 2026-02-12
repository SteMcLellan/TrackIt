import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { buildMedicationListQuery } from '../shared/data/medications';
import { readParticipantLink } from '../shared/data/participants';
import { MedicationDocument, MedicationFrequency } from '../models/medication';
import { projectMedicationToEventIndex } from '../shared/timeline/projectors';
import { appendTimelineEvent } from '../shared/timeline/write-through';

type CreateMedicationRequest = {
  name: string;
  dosageText: string;
  frequency: string;
  startDateUtc: string; // YYYY-MM-DD
  endDateUtc?: string | null;
  notes?: string | null;
};

const maxPageSize = 100;
const frequencyOptions = [
  'once-daily',
  'twice-daily',
  'three-times-daily',
  'as-needed'
] as const satisfies MedicationFrequency[];

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

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

function isNullableDateOnly(value: unknown): value is string | null | undefined {
  if (typeof value === 'undefined' || value === null) {
    return true;
  }
  return typeof value === 'string' && isDateOnly(value);
}

function parsePageSize(value?: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, maxPageSize);
}

function parseIncludeArchived(value?: string | null): boolean {
  return value === 'true' || value === '1';
}

function hasLegacyFrequencyTextField(value: unknown): boolean {
  return typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'frequencyText');
}

function validateCreateRequest(body: CreateMedicationRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  const frequency = typeof body.frequency === 'string' ? body.frequency.trim() : '';

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

const listMedicationsHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    if (!participantId) {
      return buildValidationError([
        { id: 'medications.participantId.required', message: 'Participant id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const pageSize = parsePageSize(req.query.get('pageSize'));
    const nextToken = req.query.get('nextToken');
    const includeArchived = parseIncludeArchived(req.query.get('includeArchived'));
    const query = buildMedicationListQuery(participantId, includeArchived);

    const response = await containers.medications.items.query<MedicationDocument>(query, {
      partitionKey: participantId,
      maxItemCount: pageSize,
      continuationToken: nextToken ?? undefined
    }).fetchNext();

    const payload: ListMedicationsResponse = {
      items: response.resources ?? [],
      nextToken: response.continuationToken ?? null
    };
    return { status: 200, jsonBody: payload };
  }
);

const createMedicationHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    if (!participantId) {
      return buildValidationError([
        { id: 'medications.participantId.required', message: 'Participant id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

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
    const medication: MedicationDocument = {
      id: `med_${randomUUID()}`,
      participantId,
      name: parsed.value.name.trim(),
      dosageText: parsed.value.dosageText.trim(),
      frequency,
      startDateUtc: parsed.value.startDateUtc,
      endDateUtc: parsed.value.endDateUtc ?? null,
      notes: typeof parsed.value.notes === 'string' ? parsed.value.notes.trim() : null,
      archivedAtUtc: null,
      createdAtUtc: now,
      updatedAtUtc: now
    };

    await containers.medications.items.create(medication);
    await appendTimelineEvent(
      containers.eventIndex,
      projectMedicationToEventIndex(medication, 'created')
    );

    return { status: 201, jsonBody: medication };
  }
);

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

export { listMedicationsHandler, createMedicationHandler };
