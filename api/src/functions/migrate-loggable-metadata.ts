import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { buildCosmos } from '../shared/cosmos';
import { withErrorHandling } from '../shared/auth';
import { buildValidationError } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { BehaviorIncidentDocument } from '../models/behavior-incident';

type MigrateLoggableMetadataRequest = {
  dryRun?: boolean;
  participantId?: string;
  maxItems?: number;
  continuationToken?: string;
  include?: string[];
};

type MigrateLoggableMetadataResponse = {
  dryRun: boolean;
  scanned: number;
  updated: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
  nextToken: string | null;
};

const EST_OFFSET_MINUTES = -300;

function computeLocalFieldsFromUtc(occurredAtUtc: string, offsetMinutes: number): {
  logLocalDate: string;
  logLocalTime: string;
} {
  const utcDate = new Date(occurredAtUtc);
  const localDate = new Date(utcDate.getTime() + offsetMinutes * 60 * 1000);
  const logLocalDate = localDate.toISOString().substring(0, 10);
  const logLocalTime = localDate.toISOString().substring(11, 16);
  return { logLocalDate, logLocalTime };
}

function needsMigration(doc: any): boolean {
  return (
    !doc.logLocalDate ||
    !doc.logLocalTime ||
    typeof doc.logTzOffsetMinutes !== 'number' ||
    (doc.createdAt && !doc.createdAtUtc) ||
    (doc.updatedAt && !doc.updatedAtUtc)
  );
}

function migrateDocument(doc: any): BehaviorIncidentDocument {
  const updates: Partial<BehaviorIncidentDocument> & { createdAt?: string; updatedAt?: string } = { ...doc };

  // Add local fields if missing
  if (!doc.logLocalDate || !doc.logLocalTime || typeof doc.logTzOffsetMinutes !== 'number') {
    const { logLocalDate, logLocalTime } = computeLocalFieldsFromUtc(doc.occurredAtUtc, EST_OFFSET_MINUTES);
    updates.logLocalDate = logLocalDate;
    updates.logLocalTime = logLocalTime;
    updates.logTzOffsetMinutes = EST_OFFSET_MINUTES;
  }

  // Rename createdAt to createdAtUtc
  if (doc.createdAt && !doc.createdAtUtc) {
    updates.createdAtUtc = doc.createdAt;
    delete updates.createdAt;
  }

  // Rename updatedAt to updatedAtUtc
  if (doc.updatedAt && !doc.updatedAtUtc) {
    updates.updatedAtUtc = doc.updatedAt;
    delete updates.updatedAt;
  }

  return updates as BehaviorIncidentDocument;
}

const migrateBehaviorIncidentsHandler = withErrorHandling(
  async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // Check migration key authorization
    const migrationKey = req.headers.get('x-trackit-migration-key');
    const expectedKey = process.env.MIGRATION_KEY;

    if (!expectedKey || !migrationKey || migrationKey !== expectedKey) {
      return { status: 401, jsonBody: { message: 'Unauthorized.' } };
    }

    const parsed = await parseJsonBody<MigrateLoggableMetadataRequest>(req, {
      id: 'migration.body.invalid',
      message: 'Request body must be valid JSON.'
    });
    if (!parsed.ok) {
      return parsed.response;
    }

    const body = parsed.value;
    const dryRun = body.dryRun ?? false;
    const participantId = body.participantId;
    const maxItems = body.maxItems ?? 100;
    const continuationToken = body.continuationToken;
    const include = body.include ?? ['behaviorIncidents'];

    if (!include.includes('behaviorIncidents')) {
      return buildValidationError([
        { id: 'migration.include.invalid', message: 'Only behaviorIncidents is currently supported.' }
      ]);
    }

    const { containers } = await buildCosmos();

    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Build query
    let query = 'SELECT * FROM c';
    const parameters: Array<{ name: string; value: string }> = [];

    if (participantId) {
      query += ' WHERE c.participantId = @participantId';
      parameters.push({ name: '@participantId', value: participantId });
    }

    // Execute query
    const querySpec = { query, parameters };
    const response = await containers.behaviorIncidents.items
      .query<any>(querySpec, {
        maxItemCount: maxItems,
        continuationToken: continuationToken ?? undefined
      })
      .fetchNext();

    const documents = response.resources ?? [];

    for (const doc of documents) {
      scanned++;

      try {
        if (!needsMigration(doc)) {
          skipped++;
          continue;
        }

        const migrated = migrateDocument(doc);

        if (!dryRun) {
          await containers.behaviorIncidents.items.upsert(migrated);
        }

        updated++;
      } catch (error) {
        errors.push({
          id: doc.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const result: MigrateLoggableMetadataResponse = {
      dryRun,
      scanned,
      updated,
      skipped,
      errors,
      nextToken: response.continuationToken ?? null
    };

    return { status: 200, jsonBody: result };
  }
);

app.http('migrate-loggable-metadata', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'internal/migrations/loggable-metadata',
  handler: migrateBehaviorIncidentsHandler
});

export { migrateBehaviorIncidentsHandler };
