import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import type { ParticipantContext } from '../shared/handler-context';
import { buildValidationError, ValidationErrorDetail } from '../shared/errors';
import { parseJsonBody } from '../shared/requests';
import { buildDailyReflectionListQuery, readDailyReflection } from '../shared/data/daily-reflections';
import { DailyReflectionDocument } from '../models/daily-reflection';
import { appendTimelineEvent } from '../shared/timeline/write-through';
import { projectDailyReflectionToEventIndex } from '../shared/timeline/projectors';
import { isDateOnly, isFutureDate, isValidTzOffset } from '../shared/validators';
import { bindBusinessHandler, resolveParticipantContext } from '../shared/endpoint-template';
import { composeHttpHandler } from '../shared/http-middleware';
import { errorMiddleware } from '../shared/middleware/error';
import { requestContextMiddleware } from '../shared/middleware/request-context';
import { authMiddleware } from '../shared/middleware/auth';
import { participantMiddleware } from '../shared/middleware/participant';

type UpsertDailyReflectionRequest = {
  logTzOffsetMinutes: number;
  moodScore: number;
  focusScore: number;
  energyScore: number;
  sleepScore: number;
  journalNote?: string;
};

type ListDailyReflectionsResponse = {
  items: DailyReflectionDocument[];
  nextToken: string | null;
};

type DailyReflectionSeriesPoint = {
  logLocalDate: string;
  score: number | null;
};

type MetricSummary = {
  points: DailyReflectionSeriesPoint[];
  latestScore: number | null;
  averageScore: number | null;
};

type DailyReflectionSummaryResponse = {
  startDate: string;
  endDate: string;
  days: number;
  mood: MetricSummary;
  focus: MetricSummary;
  energy: MetricSummary;
  sleep: MetricSummary;
};

const maxPageSize = 100;
const maxSummaryDays = 30;
const maxJournalNoteLength = 2000;

function parsePageSize(value?: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, maxPageSize);
}

function parseSummaryDays(value?: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 7;
  }
  return Math.min(Math.floor(parsed), maxSummaryDays);
}

function isScore(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100;
}

function validateListRequest(startDate: string | null, endDate: string | null): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (!startDate || !isDateOnly(startDate)) {
    errors.push({
      id: 'dailyReflections.startDate.invalid',
      message: 'startDate must be YYYY-MM-DD.'
    });
  }
  if (!endDate || !isDateOnly(endDate)) {
    errors.push({
      id: 'dailyReflections.endDate.invalid',
      message: 'endDate must be YYYY-MM-DD.'
    });
  }
  if (startDate && endDate && isDateOnly(startDate) && isDateOnly(endDate) && startDate > endDate) {
    errors.push({
      id: 'dailyReflections.dateRange.invalid',
      message: 'startDate must be before or equal to endDate.'
    });
  }
  return errors;
}

function validateUpsertRequest(
  body: UpsertDailyReflectionRequest,
  logLocalDate: string
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  if (!isDateOnly(logLocalDate)) {
    errors.push({
      id: 'dailyReflections.logLocalDate.invalid',
      message: 'logLocalDate must be YYYY-MM-DD.'
    });
  } else if (isFutureDate(logLocalDate)) {
    errors.push({
      id: 'dailyReflections.logLocalDate.future',
      message: 'logLocalDate cannot be in the future.'
    });
  }

  if (!isValidTzOffset(body.logTzOffsetMinutes)) {
    errors.push({
      id: 'dailyReflections.offset.invalid',
      message: 'logTzOffsetMinutes must be a valid timezone offset.'
    });
  }

  if (!isScore(body.moodScore)) {
    errors.push({
      id: 'dailyReflections.moodScore.invalid',
      message: 'moodScore must be an integer between 0 and 100.'
    });
  }
  if (!isScore(body.focusScore)) {
    errors.push({
      id: 'dailyReflections.focusScore.invalid',
      message: 'focusScore must be an integer between 0 and 100.'
    });
  }
  if (!isScore(body.energyScore)) {
    errors.push({
      id: 'dailyReflections.energyScore.invalid',
      message: 'energyScore must be an integer between 0 and 100.'
    });
  }
  if (!isScore(body.sleepScore)) {
    errors.push({
      id: 'dailyReflections.sleepScore.invalid',
      message: 'sleepScore must be an integer between 0 and 100.'
    });
  }

  if (typeof body.journalNote !== 'undefined') {
    if (typeof body.journalNote !== 'string') {
      errors.push({
        id: 'dailyReflections.journalNote.invalid',
        message: 'journalNote must be a string when provided.'
      });
    } else if (body.journalNote.trim().length > maxJournalNoteLength) {
      errors.push({
        id: 'dailyReflections.journalNote.maxLength',
        message: `journalNote must be ${maxJournalNoteLength} characters or fewer.`
      });
    }
  }

  return errors;
}

function buildDateRange(startDate: string, endDate: string): string[] {
  const output: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= end) {
    output.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return output;
}

function computeStartDate(endDate: string, days: number): string {
  const end = new Date(`${endDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - (days - 1));
  return end.toISOString().slice(0, 10);
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Number((sum / values.length).toFixed(1));
}

function buildMetricSummary(
  dateRange: string[],
  byDate: Map<string, DailyReflectionDocument>,
  selector: (item: DailyReflectionDocument) => number
): MetricSummary {
  const points = dateRange.map((logLocalDate) => {
    const item = byDate.get(logLocalDate);
    return {
      logLocalDate,
      score: item ? selector(item) : null
    };
  });

  const latestItem = [...byDate.values()]
    .sort((a, b) => b.logLocalDate.localeCompare(a.logLocalDate))[0];
  const values = [...byDate.values()].map(selector);

  return {
    points,
    latestScore: latestItem ? selector(latestItem) : null,
    averageScore: average(values)
  };
}

const listDailyReflectionsBusinessHandler = async (
  participantContext: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
  const participantId = participantContext.participantId;
  const containers = participantContext.containers;

  const startDate = req.query.get('startDate');
  const endDate = req.query.get('endDate');
  const errors = validateListRequest(startDate, endDate);
  if (errors.length > 0) {
    return buildValidationError(errors);
  }

  const pageSize = parsePageSize(req.query.get('pageSize'));
  const nextToken = req.query.get('nextToken');
  const query = buildDailyReflectionListQuery(participantId, startDate!, endDate!);
  const response = await containers.dailyReflections.items.query<DailyReflectionDocument>(query, {
    partitionKey: participantId,
    maxItemCount: pageSize,
    continuationToken: nextToken ?? undefined
  }).fetchNext();

  const payload: ListDailyReflectionsResponse = {
    items: response.resources ?? [],
    nextToken: response.continuationToken ?? null
  };

  return { status: 200, jsonBody: payload };
};

const upsertDailyReflectionBusinessHandler = async (
  participantContext: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
  const participantId = participantContext.participantId;
  const logLocalDate = req.params.logLocalDate;
  if (!logLocalDate) {
    return buildValidationError([
      {
        id: 'dailyReflections.logLocalDate.required',
        message: 'logLocalDate is required.'
      }
    ]);
  }

  const parsed = await parseJsonBody<UpsertDailyReflectionRequest>(req, {
    id: 'dailyReflections.body.invalid',
    message: 'Request body must be valid JSON.'
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const validationErrors = validateUpsertRequest(parsed.value, logLocalDate);
  if (validationErrors.length > 0) {
    return buildValidationError(validationErrors);
  }

  const reflectionId = `daily_reflection_${logLocalDate}`;
  const existing = await readDailyReflection(participantContext.containers.dailyReflections, participantId, reflectionId);
  const now = new Date().toISOString();
  const normalizedNote = typeof parsed.value.journalNote === 'string'
    ? parsed.value.journalNote.trim()
    : '';

  const reflection: DailyReflectionDocument = {
    id: reflectionId,
    participantId,
    logLocalDate,
    logTzOffsetMinutes: parsed.value.logTzOffsetMinutes,
    moodScore: parsed.value.moodScore,
    focusScore: parsed.value.focusScore,
    energyScore: parsed.value.energyScore,
    sleepScore: parsed.value.sleepScore,
    journalNote: normalizedNote.length > 0 ? normalizedNote : undefined,
    createdAtUtc: existing?.createdAtUtc ?? now,
    updatedAtUtc: now,
    createdByUserId: existing?.createdByUserId ?? participantContext.user.sub,
    updatedByUserId: participantContext.user.sub
  };

  await participantContext.containers.dailyReflections.items.upsert(reflection);
  await appendTimelineEvent(
    participantContext.containers.eventIndex,
    projectDailyReflectionToEventIndex(reflection)
  );

  return { status: 200, jsonBody: reflection };
};

const dailyReflectionsSummaryBusinessHandler = async (
  participantContext: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
  const participantId = participantContext.participantId;
  const containers = participantContext.containers;

  const endDate = req.query.get('endDate');
  const days = parseSummaryDays(req.query.get('days'));
  const errors: ValidationErrorDetail[] = [];

  if (!endDate || !isDateOnly(endDate)) {
    errors.push({
      id: 'dailyReflections.summary.endDate.invalid',
      message: 'endDate must be YYYY-MM-DD.'
    });
  } else if (isFutureDate(endDate)) {
    errors.push({
      id: 'dailyReflections.summary.endDate.future',
      message: 'endDate cannot be in the future.'
    });
  }

  if (errors.length > 0) {
    return buildValidationError(errors);
  }

  const startDate = computeStartDate(endDate!, days);
  const query = buildDailyReflectionListQuery(participantId, startDate, endDate!);
  const response = await containers.dailyReflections.items.query<DailyReflectionDocument>(query, {
    partitionKey: participantId,
    maxItemCount: days
  }).fetchAll();

  const items = response.resources ?? [];
  const byDate = new Map<string, DailyReflectionDocument>();
  for (const item of items) {
    byDate.set(item.logLocalDate, item);
  }

  const dateRange = buildDateRange(startDate, endDate!);
  const payload: DailyReflectionSummaryResponse = {
    startDate,
    endDate: endDate!,
    days,
    mood: buildMetricSummary(dateRange, byDate, (item) => item.moodScore),
    focus: buildMetricSummary(dateRange, byDate, (item) => item.focusScore),
    energy: buildMetricSummary(dateRange, byDate, (item) => item.energyScore),
    sleep: buildMetricSummary(dateRange, byDate, (item) => item.sleepScore)
  };

  return { status: 200, jsonBody: payload };
};

const listDailyReflectionsHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, listDailyReflectionsBusinessHandler)
});

const upsertDailyReflectionHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, upsertDailyReflectionBusinessHandler)
});

const dailyReflectionsSummaryHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware
  ],
  handler: bindBusinessHandler(resolveParticipantContext, dailyReflectionsSummaryBusinessHandler)
});

app.http('daily-reflections-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/daily-reflections',
  handler: listDailyReflectionsHandler
});

app.http('daily-reflections-upsert', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/daily-reflections/{logLocalDate}',
  handler: upsertDailyReflectionHandler
});

app.http('daily-reflections-summary', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'participants/{participantId}/daily-reflections/summary',
  handler: dailyReflectionsSummaryHandler
});

export {
  listDailyReflectionsHandler,
  upsertDailyReflectionHandler,
  dailyReflectionsSummaryHandler,
  listDailyReflectionsBusinessHandler,
  upsertDailyReflectionBusinessHandler,
  dailyReflectionsSummaryBusinessHandler
};
