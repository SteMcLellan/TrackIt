import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { readMedication } from '../shared/data/medications';
import { readParticipantLink } from '../shared/data/participants';
import { MedicationDocument } from '../models/medication';
import { projectMedicationToEventIndex } from '../shared/timeline/projectors';
import { appendTimelineEvent } from '../shared/timeline/write-through';

type UpdateMedicationRequest = Partial<{
  name: string;
  dosageText: string;
  frequencyText: string;
  startDateUtc: string;
  endDateUtc: string | null;
  notes: string | null;
  archivedAtUtc: string | null;
}>;

const frequencyOptions = [
  'once-daily',
  'twice-daily',
  'three-times-daily',
  'four-times-daily',
  'every-other-day',
  'weekly',
  'as-needed'
] as const;

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

function validateUpdateRequest(body: UpdateMedicationRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];

  if (typeof body.name !== 'undefined' && !isNonEmpty(body.name)) {
    errors.push({ id: 'medications.name.required', message: 'Name is required.' });
  }
  if (typeof body.dosageText !== 'undefined' && !isNonEmpty(body.dosageText)) {
    errors.push({ id: 'medications.dosage.required', message: 'Dosage is required.' });
  }
  if (typeof body.frequencyText !== 'undefined' && !isNonEmpty(body.frequencyText)) {
    errors.push({ id: 'medications.frequency.required', message: 'Frequency is required.' });
  } else if (
    typeof body.frequencyText !== 'undefined' &&
    isNonEmpty(body.frequencyText) &&
    !frequencyOptions.includes(body.frequencyText as (typeof frequencyOptions)[number])
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

  return errors;
}

const updateMedicationHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const medicationId = req.params.medicationId;
    if (!participantId || !medicationId) {
      return buildValidationError([
        { id: 'medications.participantId.required', message: 'Participant id is required.' },
        { id: 'medications.medicationId.required', message: 'Medication id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const parsed = await parseJsonBody<UpdateMedicationRequest>(req, {
      id: 'medications.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const errors = validateUpdateRequest(parsed.value);
    if (errors.length > 0) {
      return buildValidationError(errors);
    }

    const existing = await readMedication(containers.medications, participantId, medicationId);
    if (!existing) {
      return { status: 404, jsonBody: { message: 'Medication not found.' } };
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
      frequencyText:
        typeof parsed.value.frequencyText === 'string'
          ? parsed.value.frequencyText.trim()
          : existing.frequencyText,
      startDateUtc: nextStartDate,
      endDateUtc: typeof nextEndDate === 'undefined' ? existing.endDateUtc : nextEndDate,
      notes: typeof parsed.value.notes === 'string' ? parsed.value.notes.trim() : parsed.value.notes ?? existing.notes,
      archivedAtUtc:
        typeof parsed.value.archivedAtUtc === 'undefined' ? existing.archivedAtUtc : parsed.value.archivedAtUtc,
      updatedAtUtc: new Date().toISOString()
    };

    await containers.medications.items.upsert(updated);
    const action = !existing.archivedAtUtc && updated.archivedAtUtc ? 'archived' : 'updated';
    await appendTimelineEvent(
      containers.eventIndex,
      projectMedicationToEventIndex(updated, action)
    );

    return { status: 200, jsonBody: updated };
  }
);

const readMedicationHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    const medicationId = req.params.medicationId;
    if (!participantId || !medicationId) {
      return buildValidationError([
        { id: 'medications.participantId.required', message: 'Participant id is required.' },
        { id: 'medications.medicationId.required', message: 'Medication id is required.' }
      ]);
    }

    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }

    const medication = await readMedication(containers.medications, participantId, medicationId);
    if (!medication) {
      return { status: 404, jsonBody: { message: 'Medication not found.' } };
    }

    return { status: 200, jsonBody: medication };
  }
);

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

export { readMedicationHandler, updateMedicationHandler };
