# Daily Reflection — Scoring Model & UX Spec

## Overview

Parents capture a daily reflection for each participant across four dimensions: **Mood**, **Focus**, **Energy**, and **Sleep**. An optional journal note provides qualitative context. The system stores continuous 0–100 scores internally while presenting parents with five intuitive labeled buckets.

---

## 1. Scoring Model

### 1.1 Internal Storage

Each dimension is stored as an integer **0–100** on the `dailyReflections` document (see `docs/architecture/data-modeling.md`).

| Field         | Type             | Range  |
|---------------|------------------|--------|
| `moodScore`   | integer \| null  | 0–100  |
| `focusScore`  | integer \| null  | 0–100  |
| `energyScore` | integer \| null  | 0–100  |
| `sleepScore`  | integer \| null  | 0–100  |
| `journalNote` | string?          | —      |

Score fields are nullable; partial entries (any non-empty subset of dimensions) are allowed. Null dimensions are excluded from averages and trend calculations. At least one score dimension must be provided.

### 1.2 Bucket Mapping

Display buckets map from the stored score:

| Bucket     | Label         | Score Range | Midpoint |
|------------|---------------|-------------|----------|
| 1          | Very Low      | 0–19        | 10       |
| 2          | Low           | 20–39       | 30       |
| 3          | Balanced      | 40–59       | 50       |
| 4          | High          | 60–79       | 70       |
| 5          | Very High     | 80–100      | 90       |

> **Note:** Bucket 3 labels are dimension-specific in the UI (see Section 4). "Balanced" is the generic internal name used in scoring and code references — parents never see this word.

> **Energy exception — non-monotonic scale:** For Mood, Focus, and Sleep, bucket 5 represents the best outcome. Energy is different: bucket 3 (Level) is the clinical optimum. Both extremes — Drained (bucket 1) and Wired (bucket 5) — represent concerning states. Charts and automated insights must not treat a high energy score as inherently positive. See Section 5 for chart behavior and Section 6 for the `energyDeviation` derived metric.
### 1.3 Input → Storage Strategy

**Recommendation: Snap to midpoint on bucket selection.**

When a parent taps a bucket, store the midpoint value (10, 30, 50, 70, 90). This keeps the model simple while preserving the 0–100 range for future enhancements (e.g., slider input, ML-derived scores, or imported data).

If a future slider UX is introduced, preserve the exact value. The bucket assignment is always derived from the stored score at read time — never stored separately.

---

## 2. Rationale

### Why 0–100 Internally?

- **Analytics resolution**: Continuous scores enable trend smoothing, moving averages, standard deviations, and correlation analysis without information loss.
- **Future input flexibility**: A slider, voice-based input, or automated scoring could produce values outside the 5 midpoints. The schema already accommodates them.
- **Interoperability**: Research-grade scales (e.g., Conners, BRIEF) often use continuous scoring. A 0–100 range translates cleanly.

### Why Hide Numeric Values from Parents?

- **Reduces false precision**: "72 mood" implies measurement accuracy that subjective parent input cannot provide. It invites unhelpful comparison ("why 72 and not 75?").
- **Lowers cognitive load**: Five labels are faster to select than positioning a number. This aligns with TrackIt's low-friction recording principle.
- **Avoids anchoring bias**: Visible numbers cause parents to fixate on achieving or avoiding specific scores rather than reflecting honestly.

### Alternative Considered: Direct 1–5 Storage

| Aspect              | 0–100 (chosen)                       | 1–5 direct                        |
|---------------------|--------------------------------------|------------------------------------|
| Analytics potential | High — smoothing, correlations       | Low — coarse, limited statistics   |
| Future flexibility  | Supports sliders, ML, imports        | Locked to 5 levels                 |
| Schema migration    | None needed for new input modes      | Requires migration if scale changes|
| Storage cost        | Negligible (integer vs integer)      | Same                               |
| Complexity          | Slightly higher (bucket derivation)  | Simpler                            |

**Verdict**: 0–100 costs almost nothing extra and preserves significant analytical upside.

---

## 3. Sample Data Record

### TypeScript Interface

```ts
interface DailyReflectionDocument {
  id: string;
  participantId: string;
  logLocalDate: string;          // "2026-02-14"
  moodScore: number | null;      // 0–100, null if not provided
  focusScore: number | null;     // 0–100, null if not provided
  energyScore: number | null;    // 0–100, null if not provided
  sleepScore: number | null;     // 0–100, null if not provided
  journalNote?: string;
  createdAtUtc: string;          // ISO 8601
  updatedAtUtc?: string;         // ISO 8601
  createdByUserId: string;
}
```

### Example Document

```json
{
  "id": "refl:participant-abc:2026-02-14",
  "participantId": "participant-abc",
  "logLocalDate": "2026-02-14",
  "moodScore": 70,
  "focusScore": 30,
  "energyScore": 50,
  "sleepScore": 90,
  "journalNote": "Good morning but lost focus after lunch. Slept really well last night.",
  "createdAtUtc": "2026-02-14T22:15:00Z",
  "createdByUserId": "user-xyz"
}
```

### Downstream Interpretation

| Dimension | Score | Label      | Interpretation                        |
|-----------|-------|------------|---------------------------------------|
| Mood      | 70    | Upbeat     | Mostly positive and cooperative       |
| Focus     | 30    | Drifting   | Easily pulled off task                |
| Energy    | 50    | Level      | Normal energy levels                  |
| Sleep     | 90    | Refreshed  | Woke up bright-eyed and well-rested   |

This record would contribute to trend lines showing mood trending high while focus dipped. A correlation engine could flag the sleep → mood relationship as a positive pattern.

---

## 4. UX Copy — Bucket Labels by Dimension

Each dimension uses labels that describe *that facet* in plain language rather than generic high/low terms.

### Mood

| Bucket | Label        | Micro-copy                                                     |
|--------|--------------|----------------------------------------------------------------|
| 1      | Struggling   | Meltdowns, shutdowns, or persistent distress through the day.  |
| 2      | Irritable    | More reactive or flat than usual — quick to frustrate or disengage.  |
| 3      | Steady       | Typical ups and downs — nothing stood out.                     |
| 4      | Upbeat       | Mostly positive, cooperative, and rolling with things.         |
| 5      | Thriving     | Genuinely happy, engaged, and rolling with challenges.         |

### Focus

| Bucket | Label        | Micro-copy                                                     |
|--------|--------------|----------------------------------------------------------------|
| 1      | Scattered    | Couldn't get started or stay on anything — constant redirection to make any progress. |
| 2      | Drifting     | Started tasks but drifted off repeatedly — needed regular reminders to get back on track. |
| 3      | Typical      | Some distractibility but managed to get things done.           |
| 4      | Dialed In    | Stayed on task well with minimal prompting.                    |
| 5      | Locked In    | Unusually sustained attention across activities.               |

> **Note:** "Typical" is intentionally distinct from "Steady" (used in Mood and Energy). It anchors parents to *this child's normal* rather than implying a neutral midpoint — the right framing for neurodivergent tracking.

### Energy

| Bucket | Label        | Micro-copy                                                     |
|--------|--------------|----------------------------------------------------------------|
| 1      | Drained      | Lethargic or listless — hard to get going or stay engaged.     |
| 2      | Sluggish     | Slow to start or faded early — less pep than usual.           |
| 3      | Level        | Normal energy throughout the day.                              |
| 4      | Buzzing      | Noticeably more active and on-the-go than usual.              |
| 5      | Wired        | Noticeably restless or hyperactive — hard to settle or channel the energy. |
> **Non-monotonic dimension:** Unlike Mood, Focus, and Sleep, high energy is not a positive signal. Both extremes (Drained and Wired) indicate dysregulation; Level is the optimum. The raw score (0–100) preserves the *direction* of dysregulation — underactive vs. overactive — which is clinically useful. Charts and insights must not render energy with a directional "higher = better" assumption.

### Sleep

| Bucket | Label        | Micro-copy                                                     |
|--------|--------------|----------------------------------------------------------------|
| 1      | Rough Night  | Barely slept — major trouble falling or staying asleep.        |
| 2      | Restless     | Woke frequently, tossed and turned, or didn't get enough hours. |
| 3      | Fine         | Typical night — nothing unusual to note.                       |
| 4      | Solid        | Fell asleep easily and stayed asleep through the night.        |
| 5      | Refreshed    | Woke up bright-eyed and clearly well-rested.                   |

---

## 5. Edge Cases & Behavior

### Missing Entries

- **No entry for a day**: The day appears as a gap in trend charts (no interpolation). A gentle prompt ("You haven't reflected on yesterday yet") can appear on the dashboard the following morning.
- **Partial entry** (some dimensions filled, some not): Allow save with any non-zero subset. Unfilled dimensions store `null`, not zero. Null dimensions are excluded from trend calculations.

### Extreme Fluctuations

- **Day-to-day swing** (e.g., mood 90 → 10): Flag in the trend view with a visual marker but do not warn or block. Volatility itself is a useful signal.
- **Sustained extremes** (e.g., 5+ days at Very Low mood): Candidates for automated insight ("Mood has been low for 5 consecutive days").

### Ambiguous Input

- **Parent unsure**: Default selection is the middle bucket (bucket 3), visually pre-selected. Tooltip: *"If you're unsure, pick the middle option — it means a typical day. Adjust if something stood out."*
- **Between two buckets**: Because we snap to midpoints, the parent picks whichever label resonates more. No half-step or "between" option — simplicity over precision.

### Outlier Days vs. Trend

- Trend calculations should use a **7-day rolling average** by default to smooth single-day spikes.
- Individual day views always show the actual bucket, not the average.
- Charts should distinguish data points from trend lines so parents see both signal and pattern.

### Energy Chart Behavior

Because energy is non-monotonic, its trend chart must differ from the other three dimensions:

- **No directional arrow or color gradient** (no green-for-high / red-for-low treatment).
- **Horizontal reference line at Level (score 50)** so deviations in both directions are visually apparent.
- Each data point shows the bucket label on hover/tap rather than a raw score.
- Automated insight copy must not use phrasing like "energy was high today" without the label context — always pair with the label (e.g., "Energy was Wired — noticeably hyperactive").

---

## 6. Future Enhancements

### Personalized Baselines

After 14+ days of data, compute a per-participant baseline (mean and standard deviation per dimension). Display deviations from personal baseline rather than absolute labels — e.g., "Focus was lower than Alex's usual" instead of just "Low."

### Volatility Detection

Track standard deviation over a rolling window. High volatility (frequent swings between extremes) is itself a meaningful clinical signal for ADHD and can trigger insights or be surfaced in reports.

### Automated Insights

Pattern detection candidates:

| Pattern                          | Insight Example                                                  |
|----------------------------------|------------------------------------------------------------------|
| Sleep ↑ → Focus ↑ next day      | "Alex tends to focus better after a good night's sleep."         |
| Medication start → Mood change   | "Mood shifted after starting [medication] on [date]."            |
| Weekend vs. weekday differences  | "Energy tends to be higher on weekends."                         |
| Pre-incident mood pattern        | "Behavior incidents often follow days rated Low mood."           |

### Energy Deviation Metric

For analytics that need to measure "how far from typical" rather than "how much energy," derive an `energyDeviation` metric at query time:

```
energyDeviation = abs(energyScore − 50)
```

This collapses both extremes (Drained at 10 → deviation 40; Wired at 90 → deviation 40) into a single dysregulation signal. Use `energyDeviation` for:

- Correlating energy dysregulation with behavior incidents or focus dips
- Detecting sustained dysregulation (e.g., 5+ consecutive days with deviation ≥ 30)
- Any chart or insight that treats "far from Level" as the meaningful signal

The raw `energyScore` is still the canonical stored value and should be preserved — it carries directional information (underactive vs. overactive) that `energyDeviation` discards.

### Correlation with Other Domains

The 0–100 scoring model enables direct statistical correlation with:

- **Medication logs**: Score changes after medication start/stop/dose change.
- **Sleep scores**: Sleep as predictor for next-day mood/focus/energy.
- **Behavior incidents**: Score patterns preceding incident clusters.
- **Time patterns**: Day-of-week, seasonal, or school-schedule effects.

### Slider Input (Optional Future UX)

If parents want finer control, offer an optional slider that maps to the 0–100 range. The bucket label updates in real time as the slider moves. This preserves the label-first UX while capturing more granular data.

---

## 7. Acceptance Criteria

### US-DR-001: Bucket Selection Input

- [x] Parent sees 5 labeled buckets per dimension (Mood, Focus, Energy, Sleep).
- [x] Tapping a bucket highlights it and stores the midpoint value (10/30/50/70/90).
- [x] Balanced is pre-selected as default.
- [x] No raw numeric values are visible in the UI.
- [x] Micro-copy is displayed for each bucket to guide selection.

### US-DR-002: Journal Note

- [x] Free-text field below the dimension selectors.
- [x] Optional — reflection can save without a note.
- [x] Character limit: 2000 characters with visible counter.

### US-DR-003: Save Behavior

- [x] One reflection per participant per `logLocalDate`.
- [x] Re-opening the same day loads existing values for editing.
- [x] Save updates `updatedAtUtc`; first save sets `createdAtUtc`.
- [x] Partial entries (some dimensions null) are allowed.

### US-DR-004: Display & Trend

- [x] Dashboard card shows today's reflection as bucket labels (or prompt if missing).
- [x] Trend view shows 7-day rolling average as a line with individual day dots.
- [x] Missing days appear as gaps, not zeros.
- [x] Extreme swings are visually marked on the chart.
- [x] Energy chart displays a horizontal reference line at Level (score 50).
- [x] Energy chart has no directional color gradient or up/down arrow treatment.
- [x] Automated insight copy for energy always includes the bucket label alongside any score reference.

### US-DR-005: Edge Case Handling

- [x] Null dimensions excluded from averages and trend calculations.
- [x] Default selection (Balanced) has tooltip explaining its meaning.
- [x] No interpolation for missing days in charts.
