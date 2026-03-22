import { describe, expect, it, vi, beforeEach, Mock } from 'vitest';
import { createMedicationBusinessHandler } from '../../src/functions/medications';
import { createCosmosContainersStub } from '../helpers/cosmos-stubs';
import { mockHttpRequest } from '../helpers/http';
import { ParticipantContext } from '../../src/shared/handler-context';
import { appendTimelineEvent } from '../../src/shared/timeline/write-through';

vi.mock('../../src/shared/timeline/write-through', () => ({
  appendTimelineEvent: vi.fn().mockResolvedValue(undefined)
}));

describe('createMedicationBusinessHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildContext(): ParticipantContext {
    const containers = createCosmosContainersStub();
    return {
      user: {
        sub: 'user-1',
        iat: 1,
        exp: 2
      },
      containers,
      participantId: 'participant-1',
      link: {
        id: 'user-1:participant-1',
        userId: 'user-1',
        participantId: 'participant-1',
        role: 'manager',
        createdAtUtc: '2026-02-01T00:00:00.000Z'
      }
    };
  }

  it('creates medication and returns 201 for valid payload', async () => {
    const ctx = buildContext();
    const req = mockHttpRequest({
      method: 'POST',
      body: {
        name: 'Ibuprofen',
        dosageText: '200mg',
        frequency: 'once-daily',
        startDateUtc: '2026-02-01'
      }
    });

    const response = await createMedicationBusinessHandler(ctx, req);

    expect(response.status).toBe(201);
    const createSpy = ctx.containers.medications.items.create as unknown as Mock;
    expect(createSpy).toHaveBeenCalledTimes(1);
    const createdMedication = createSpy.mock.calls[0][0] as { participantId: string; name: string };
    expect(createdMedication.participantId).toBe('participant-1');
    expect(createdMedication.name).toBe('Ibuprofen');
    expect(vi.mocked(appendTimelineEvent)).toHaveBeenCalledTimes(1);
  });

  it('creates interval medication when intervalSchedule is valid', async () => {
    const ctx = buildContext();
    const req = mockHttpRequest({
      method: 'POST',
      body: {
        name: 'Patch',
        dosageText: '15mg',
        frequency: 'interval-days',
        intervalSchedule: { intervalDays: 7, anchorPolicy: 'reset-on-taken' },
        startDateUtc: '2026-02-01'
      }
    });

    const response = await createMedicationBusinessHandler(ctx, req);

    expect(response.status).toBe(201);
    const createSpy = ctx.containers.medications.items.create as unknown as Mock;
    const createdMedication = createSpy.mock.calls[0][0] as { intervalSchedule?: { intervalDays: number } };
    expect(createdMedication.intervalSchedule?.intervalDays).toBe(7);
  });

  it('returns interval schedule required when frequency is interval-days', async () => {
    const ctx = buildContext();
    const req = mockHttpRequest({
      method: 'POST',
      body: {
        name: 'Patch',
        dosageText: '15mg',
        frequency: 'interval-days',
        startDateUtc: '2026-02-01'
      }
    });

    const response = await createMedicationBusinessHandler(ctx, req);
    const ids = ((response.jsonBody as { errors?: Array<{ id: string }> }).errors ?? []).map((error) => error.id);

    expect(response.status).toBe(400);
    expect(ids).toContain('medications.intervalSchedule.required');
  });

  it('returns validation error when body is invalid json', async () => {
    const ctx = buildContext();
    const req = mockHttpRequest({
      method: 'POST',
      rawBodyString: '{invalid-json'
    });

    const response = await createMedicationBusinessHandler(ctx, req);

    expect(response.status).toBe(400);
    expect((response.jsonBody as { errors?: Array<{ id: string }> }).errors?.[0]?.id).toBe('medications.body.invalid');
  });

  it('returns validation error when legacy frequencyText is sent', async () => {
    const ctx = buildContext();
    const req = mockHttpRequest({
      method: 'POST',
      body: {
        name: 'Ibuprofen',
        dosageText: '200mg',
        frequency: 'once-daily',
        frequencyText: 'old-value',
        startDateUtc: '2026-02-01'
      }
    });

    const response = await createMedicationBusinessHandler(ctx, req);
    expect(response.status).toBe(400);
    expect((response.jsonBody as { errors?: Array<{ id: string }> }).errors?.[0]?.id).toBe(
      'medications.frequencyText.unsupported'
    );
  });

  it('returns validation errors for bad payload values', async () => {
    const ctx = buildContext();
    const req = mockHttpRequest({
      method: 'POST',
      body: {
        name: '',
        dosageText: '',
        frequency: 'invalid',
        startDateUtc: '2026-99-99'
      }
    });

    const response = await createMedicationBusinessHandler(ctx, req);
    const ids = ((response.jsonBody as { errors?: Array<{ id: string }> }).errors ?? []).map((error) => error.id);

    expect(response.status).toBe(400);
    expect(ids).toContain('medications.name.required');
    expect(ids).toContain('medications.dosage.required');
    expect(ids).toContain('medications.frequency.invalid');
    expect(ids).toContain('medications.startDate.invalid');
  });
});

