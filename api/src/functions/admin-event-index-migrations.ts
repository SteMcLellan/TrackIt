import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../shared/authorize';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { parseJsonBody } from '../shared/requests';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { requireAdmin } from '../shared/admin';
import { BehaviorIncidentDocument } from '../models/behavior-incident';
import { MedicationLogDocument } from '../models/medication-log';
import { MedicationDocument } from '../models/medication';
import { EventIndexDocument } from '../models/event-index';
import {
  projectIncidentToEventIndex,
  projectMedicationLogToEventIndex,
  projectMedicationToEventIndex
} from '../shared/timeline/projectors';

type BackfillSource = 'incidents' | 'medicationLogs' | 'medications';

type BackfillRequest = {
  dryRun?: boolean;
  participantId?: string;
  include?: BackfillSource[];
  maxItems?: number;
  continuation?: Partial<Record<BackfillSource, string>>;
};

type BackfillResponse = {
  dryRun: boolean;
  scanned: number;
  projected: number;
  errors: Array<{ source: BackfillSource; id: string; error: string }>;
  continuation: Partial<Record<BackfillSource, string | null>>;
};

type VerifyRequest = {
  participantId?: string;
  include?: BackfillSource[];
  maxItems?: number;
  continuation?: Partial<Record<BackfillSource, string>>;
};

type VerifyResponse = {
  scanned: number;
  matched: number;
  missing: number;
  mismatched: number;
  errors: Array<{ source: BackfillSource; id: string; error: string }>;
  continuation: Partial<Record<BackfillSource, string | null>>;
};

const allSources: BackfillSource[] = ['incidents', 'medicationLogs', 'medications'];

function parseSources(sources?: BackfillSource[]): BackfillSource[] {
  if (!Array.isArray(sources) || sources.length === 0) {
    return allSources;
  }
  return sources.filter((source) => allSources.includes(source));
}

function parseMaxItems(value?: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return 250;
  }
  return Math.min(value, 1000);
}

function buildSourceQuery(participantId?: string) {
  if (!participantId) {
    return {
      querySpec: { query: 'SELECT * FROM c', parameters: [] as Array<{ name: string; value: string }> },
      queryOptions: {}
    };
  }
  return {
    querySpec: {
      query: 'SELECT * FROM c WHERE c.participantId = @participantId',
      parameters: [{ name: '@participantId', value: participantId }]
    },
    queryOptions: { partitionKey: participantId }
  };
}

function validateBackfillRequest(body: BackfillRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (body.include && body.include.some((source) => !allSources.includes(source))) {
    errors.push({ id: 'timeline.backfill.include.invalid', message: 'include contains an invalid source.' });
  }
  return errors;
}

function validateVerifyRequest(body: VerifyRequest): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (body.include && body.include.some((source) => !allSources.includes(source))) {
    errors.push({ id: 'timeline.verify.include.invalid', message: 'include contains an invalid source.' });
  }
  return errors;
}

const adminBackfillTimelineHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const auth = authorize(context, req);
    const adminError = requireAdmin(auth);
    if (adminError) {
      return adminError;
    }

    const parsed = await parseJsonBody<BackfillRequest>(req, {
      id: 'timeline.backfill.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const validationErrors = validateBackfillRequest(parsed.value);
    if (validationErrors.length > 0) {
      return buildValidationError(validationErrors);
    }

    const dryRun = parsed.value.dryRun ?? false;
    const participantId = parsed.value.participantId;
    const include = parseSources(parsed.value.include);
    const maxItems = parseMaxItems(parsed.value.maxItems);
    const continuation = parsed.value.continuation ?? {};
    const { containers } = await buildCosmos();

    let remaining = maxItems;
    let scanned = 0;
    let projected = 0;
    const errors: Array<{ source: BackfillSource; id: string; error: string }> = [];
    const nextContinuation: Partial<Record<BackfillSource, string | null>> = {};

    for (const source of include) {
      if (remaining <= 0) {
        nextContinuation[source] = continuation[source] ?? null;
        continue;
      }

      const { querySpec, queryOptions } = buildSourceQuery(participantId);
      if (source === 'incidents') {
        const response = await containers.behaviorIncidents.items.query<BehaviorIncidentDocument>(querySpec, {
          ...queryOptions,
          maxItemCount: remaining,
          continuationToken: continuation[source]
        }).fetchNext();
        nextContinuation[source] = response.continuationToken ?? null;
        for (const doc of response.resources ?? []) {
          scanned += 1;
          try {
            const event = projectIncidentToEventIndex(doc);
            if (!dryRun) {
              await containers.eventIndex.items.upsert(event);
            }
            projected += 1;
          } catch (error) {
            errors.push({
              source,
              id: doc.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
      } else if (source === 'medicationLogs') {
        const response = await containers.medicationLogs.items.query<MedicationLogDocument>(querySpec, {
          ...queryOptions,
          maxItemCount: remaining,
          continuationToken: continuation[source]
        }).fetchNext();
        nextContinuation[source] = response.continuationToken ?? null;
        for (const doc of response.resources ?? []) {
          scanned += 1;
          try {
            const event = projectMedicationLogToEventIndex(doc);
            if (!dryRun) {
              await containers.eventIndex.items.upsert(event);
            }
            projected += 1;
          } catch (error) {
            errors.push({
              source,
              id: doc.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
      } else {
        const response = await containers.medications.items.query<MedicationDocument>(querySpec, {
          ...queryOptions,
          maxItemCount: remaining,
          continuationToken: continuation[source]
        }).fetchNext();
        nextContinuation[source] = response.continuationToken ?? null;
        for (const doc of response.resources ?? []) {
          scanned += 1;
          try {
            const event = projectMedicationToEventIndex(doc, 'snapshot');
            if (!dryRun) {
              await containers.eventIndex.items.upsert(event);
            }
            projected += 1;
          } catch (error) {
            errors.push({
              source,
              id: doc.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
      }
    }

    const payload: BackfillResponse = {
      dryRun,
      scanned,
      projected,
      errors,
      continuation: nextContinuation
    };

    return { status: 200, jsonBody: payload };
  }
);

const adminVerifyTimelineHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const auth = authorize(context, req);
    const adminError = requireAdmin(auth);
    if (adminError) {
      return adminError;
    }

    const parsed = await parseJsonBody<VerifyRequest>(req, {
      id: 'timeline.verify.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const validationErrors = validateVerifyRequest(parsed.value);
    if (validationErrors.length > 0) {
      return buildValidationError(validationErrors);
    }

    const participantId = parsed.value.participantId;
    const include = parseSources(parsed.value.include);
    const maxItems = parseMaxItems(parsed.value.maxItems);
    const continuation = parsed.value.continuation ?? {};
    const { containers } = await buildCosmos();

    let remaining = maxItems;
    let scanned = 0;
    let matched = 0;
    let missing = 0;
    let mismatched = 0;
    const errors: Array<{ source: BackfillSource; id: string; error: string }> = [];
    const nextContinuation: Partial<Record<BackfillSource, string | null>> = {};

    for (const source of include) {
      if (remaining <= 0) {
        nextContinuation[source] = continuation[source] ?? null;
        continue;
      }

      const { querySpec, queryOptions } = buildSourceQuery(participantId);
      if (source === 'incidents') {
        const response = await containers.behaviorIncidents.items.query<BehaviorIncidentDocument>(querySpec, {
          ...queryOptions,
          maxItemCount: remaining,
          continuationToken: continuation[source]
        }).fetchNext();
        nextContinuation[source] = response.continuationToken ?? null;
        for (const doc of response.resources ?? []) {
          scanned += 1;
          try {
            const expected = projectIncidentToEventIndex(doc);
            const actual = await containers.eventIndex.item(expected.id, expected.participantId)
              .read<EventIndexDocument>();
            if (!actual.resource) {
              missing += 1;
              continue;
            }
            if (
              actual.resource.sourceId !== expected.sourceId ||
              actual.resource.sourceVersion !== expected.sourceVersion
            ) {
              mismatched += 1;
              continue;
            }
            matched += 1;
          } catch (error) {
            errors.push({
              source,
              id: doc.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
      } else if (source === 'medicationLogs') {
        const response = await containers.medicationLogs.items.query<MedicationLogDocument>(querySpec, {
          ...queryOptions,
          maxItemCount: remaining,
          continuationToken: continuation[source]
        }).fetchNext();
        nextContinuation[source] = response.continuationToken ?? null;
        for (const doc of response.resources ?? []) {
          scanned += 1;
          try {
            const expected = projectMedicationLogToEventIndex(doc);
            const actual = await containers.eventIndex.item(expected.id, expected.participantId)
              .read<EventIndexDocument>();
            if (!actual.resource) {
              missing += 1;
              continue;
            }
            if (
              actual.resource.sourceId !== expected.sourceId ||
              actual.resource.sourceVersion !== expected.sourceVersion
            ) {
              mismatched += 1;
              continue;
            }
            matched += 1;
          } catch (error) {
            errors.push({
              source,
              id: doc.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
      } else {
        const response = await containers.medications.items.query<MedicationDocument>(querySpec, {
          ...queryOptions,
          maxItemCount: remaining,
          continuationToken: continuation[source]
        }).fetchNext();
        nextContinuation[source] = response.continuationToken ?? null;
        for (const doc of response.resources ?? []) {
          scanned += 1;
          try {
            const expected = projectMedicationToEventIndex(doc, 'snapshot');
            const actual = await containers.eventIndex.item(expected.id, expected.participantId)
              .read<EventIndexDocument>();
            if (!actual.resource) {
              missing += 1;
              continue;
            }
            if (
              actual.resource.sourceId !== expected.sourceId ||
              actual.resource.sourceVersion !== expected.sourceVersion
            ) {
              mismatched += 1;
              continue;
            }
            matched += 1;
          } catch (error) {
            errors.push({
              source,
              id: doc.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
      }
    }

    const payload: VerifyResponse = {
      scanned,
      matched,
      missing,
      mismatched,
      errors,
      continuation: nextContinuation
    };

    return { status: 200, jsonBody: payload };
  }
);

app.http('admin-timeline-backfill', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'internal/admin/migrations/event-index/backfill',
  handler: adminBackfillTimelineHandler
});

app.http('admin-timeline-verify', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'internal/admin/migrations/event-index/verify',
  handler: adminVerifyTimelineHandler
});

export { adminBackfillTimelineHandler, adminVerifyTimelineHandler };
