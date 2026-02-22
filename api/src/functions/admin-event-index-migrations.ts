import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseJsonBody } from '../shared/requests';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { BehaviorIncidentDocument } from '../models/behavior-incident';
import { MedicationLogDocument } from '../models/medication-log';
import { MedicationDocument } from '../models/medication';
import { DailyReflectionDocument } from '../models/daily-reflection';
import { EventIndexDocument } from '../models/event-index';
import {
  projectIncidentToEventIndex,
  projectMedicationLogToEventIndex,
  projectMedicationToEventIndex,
  projectDailyReflectionToEventIndex
} from '../shared/timeline/projectors';
import type { AuthContext } from '../shared/handler-context';
import { composeHttpHandler } from '../shared/http-middleware';
import { getRequestState } from '../shared/request-state';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { adminGuardMiddleware } from '../shared/middleware/admin-guard';

type BackfillSource = 'incidents' | 'medicationLogs' | 'medications' | 'dailyReflections';

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

const allSources: BackfillSource[] = ['incidents', 'medicationLogs', 'medications', 'dailyReflections'];

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

function requireAuthContext(context: InvocationContext): AuthContext {
  const state = getRequestState(context);
  if (!state.containers || !state.user) {
    throw new Error('Auth context was not initialized.');
  }

  return {
    user: state.user,
    containers: state.containers
  };
}

const adminBackfillTimelineHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    adminGuardMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const authContext = requireAuthContext(context);

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
    const containers = authContext.containers;

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

      switch (source) {
        case 'incidents': {
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
              errors.push({ source, id: doc.id, error: error instanceof Error ? error.message : String(error) });
            }
          }
          remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
          break;
        }
        case 'medicationLogs': {
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
              errors.push({ source, id: doc.id, error: error instanceof Error ? error.message : String(error) });
            }
          }
          remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
          break;
        }
        case 'medications': {
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
              errors.push({ source, id: doc.id, error: error instanceof Error ? error.message : String(error) });
            }
          }
          remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
          break;
        }
        case 'dailyReflections': {
          const response = await containers.dailyReflections.items.query<DailyReflectionDocument>(querySpec, {
            ...queryOptions,
            maxItemCount: remaining,
            continuationToken: continuation[source]
          }).fetchNext();
          nextContinuation[source] = response.continuationToken ?? null;
          for (const doc of response.resources ?? []) {
            scanned += 1;
            try {
              const event = projectDailyReflectionToEventIndex(doc);
              if (!dryRun) {
                await containers.eventIndex.items.upsert(event);
              }
              projected += 1;
            } catch (error) {
              errors.push({ source, id: doc.id, error: error instanceof Error ? error.message : String(error) });
            }
          }
          remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
          break;
        }
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
});

const adminVerifyTimelineHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    adminGuardMiddleware
  ],
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const authContext = requireAuthContext(context);

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
    const containers = authContext.containers;

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

      switch (source) {
        case 'incidents': {
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
              const actual = await containers.eventIndex.item(expected.id, expected.participantId).read<EventIndexDocument>();
              if (!actual.resource) {
                missing += 1;
                continue;
              }
              if (actual.resource.sourceId !== expected.sourceId || actual.resource.sourceVersion !== expected.sourceVersion) {
                mismatched += 1;
                continue;
              }
              matched += 1;
            } catch (error) {
              errors.push({ source, id: doc.id, error: error instanceof Error ? error.message : String(error) });
            }
          }
          remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
          break;
        }
        case 'medicationLogs': {
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
              const actual = await containers.eventIndex.item(expected.id, expected.participantId).read<EventIndexDocument>();
              if (!actual.resource) {
                missing += 1;
                continue;
              }
              if (actual.resource.sourceId !== expected.sourceId || actual.resource.sourceVersion !== expected.sourceVersion) {
                mismatched += 1;
                continue;
              }
              matched += 1;
            } catch (error) {
              errors.push({ source, id: doc.id, error: error instanceof Error ? error.message : String(error) });
            }
          }
          remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
          break;
        }
        case 'medications': {
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
              const actual = await containers.eventIndex.item(expected.id, expected.participantId).read<EventIndexDocument>();
              if (!actual.resource) {
                missing += 1;
                continue;
              }
              if (actual.resource.sourceId !== expected.sourceId || actual.resource.sourceVersion !== expected.sourceVersion) {
                mismatched += 1;
                continue;
              }
              matched += 1;
            } catch (error) {
              errors.push({ source, id: doc.id, error: error instanceof Error ? error.message : String(error) });
            }
          }
          remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
          break;
        }
        case 'dailyReflections': {
          const response = await containers.dailyReflections.items.query<DailyReflectionDocument>(querySpec, {
            ...queryOptions,
            maxItemCount: remaining,
            continuationToken: continuation[source]
          }).fetchNext();
          nextContinuation[source] = response.continuationToken ?? null;
          for (const doc of response.resources ?? []) {
            scanned += 1;
            try {
              const expected = projectDailyReflectionToEventIndex(doc);
              const actual = await containers.eventIndex.item(expected.id, expected.participantId).read<EventIndexDocument>();
              if (!actual.resource) {
                missing += 1;
                continue;
              }
              if (actual.resource.sourceId !== expected.sourceId || actual.resource.sourceVersion !== expected.sourceVersion) {
                mismatched += 1;
                continue;
              }
              matched += 1;
            } catch (error) {
              errors.push({ source, id: doc.id, error: error instanceof Error ? error.message : String(error) });
            }
          }
          remaining = Math.max(0, remaining - (response.resources?.length ?? 0));
          break;
        }
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
});

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
