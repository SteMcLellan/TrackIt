# Dynamic Hero Phrase — Insights Dashboard

## Status

Implemented in backend and frontend.
Last updated: 2026-03-14.

- Hero phrase is score-driven, selected from 6 tiers (no-data + tiers 1–5).
- Phrases are fetched from `GET /hero-phrase-tiers` on each dashboard load.
- Frontend falls back to hardcoded defaults if the API returns 404 or errors.
- `heroPhraseTiers` Cosmos container must be seeded with the `"default"` document to serve live phrases.

---

## Product Intent

The insights dashboard hero previously always read *"{participant} is thriving"* regardless of how the child's week went. This felt hollow on good weeks and tone-deaf on bad ones.

The hero phrase now reflects the child's actual weekly wellbeing by selecting copy from a tier that matches a composite score. Caregivers get acknowledgement that the app understands what kind of week it was.

---

## Composite Score

Computed from `latestScore` values in `summaryResource`:

- **Includes:** mood, focus, sleep.
- **Excludes:** energy. Energy is non-monotonic (both Drained and Wired are dysregulated states), which would structurally lock hyperactive-impulsive children out of high tiers every week. Energy dysregulation is surfaced separately in the metric cards.
- **Formula:** `avg(moodScore, focusScore, sleepScore)` — nulls filtered before averaging.
- **No-data:** if all three scores are `null`, the no-data tier is used.

---

## Phrase Tiers

| Tier ID | Condition | Description |
|---|---|---|
| `no-data` | All scores null | No reflections logged this week |
| `tier1` | 0–24 | Hard week |
| `tier2` | 25–44 | Below average |
| `tier3` | 45–59 | Typical / steady |
| `tier4` | 60–79 | Good week |
| `tier5` | 80–100 | Exceptional week |

Each tier has 10 phrase pairs (`headline` + `subtext`). The phrase rotates daily by `dayOfYear % 10` — same phrase all day, different each day within the tier.

---

## Loading State

While `summaryResource` is loading, the hero shows the static placeholder *"is thriving. / Weekly summary and today's rhythm."* — no skeleton or flicker.

---

## Data Architecture

### Cosmos container

- **Container:** `heroPhraseTiers`
- **Partition key:** `/id`
- **Single document:** `id: "default"`

### API endpoint

- **Route:** `GET /hero-phrase-tiers`
- **Auth:** authenticated (no participant scope)
- **Returns:** full tiers document on 200; 404 if unseeded.

### Frontend fallback

`FALLBACK_HERO_PHRASE_TIERS` in `hero-phrase-fallback-tiers.ts` contains all 60 phrases. Used when the API returns 404 or errors — no user-visible degradation.

---

## Cosmos Seed Document

Paste this into the Azure Portal Data Explorer (or use Azure CLI) to seed the `heroPhraseTiers` container. Set the partition key to `/id`.

```json
{
  "id": "default",
  "tiers": [
    {
      "id": "no-data",
      "condition": "no-data",
      "phrases": [
        { "headline": "{participant} is your focus this week.", "subtext": "Start logging to see patterns emerge." },
        { "headline": "{participant} is ready to be understood.", "subtext": "Each reflection adds a piece of the picture." },
        { "headline": "{participant} is a story in progress.", "subtext": "Logging daily helps you see the patterns." },
        { "headline": "{participant} is full of patterns to uncover.", "subtext": "A few reflections go a long way." },
        { "headline": "{participant} is ready when you are.", "subtext": "Daily reflections build the clearest picture." },
        { "headline": "{participant} is yours to discover.", "subtext": "Every log brings the picture into focus." },
        { "headline": "{participant} is at the start of something.", "subtext": "Consistent logging reveals patterns over time." },
        { "headline": "{participant} is worth tracking closely.", "subtext": "Log a few days to start seeing patterns." },
        { "headline": "{participant} is waiting for your first log.", "subtext": "A week of data reveals what single days can't." },
        { "headline": "{participant} is just getting started.", "subtext": "Your first reflections are the most important ones." }
      ]
    },
    {
      "id": "tier1",
      "condition": { "min": 0, "max": 24 },
      "phrases": [
        { "headline": "{participant} is having a hard stretch.", "subtext": "Tough weeks happen. Keep showing up." },
        { "headline": "{participant} is going through a rough patch.", "subtext": "This week was hard — your attention matters." },
        { "headline": "{participant} is in a challenging season.", "subtext": "Hard weeks have the most to teach." },
        { "headline": "{participant} is having a tough week.", "subtext": "Hard weeks end. You're not alone in this." },
        { "headline": "{participant} is struggling right now.", "subtext": "You've been in this — that already counts." },
        { "headline": "{participant} is navigating some real difficulty.", "subtext": "You're tracking through it — that counts." },
        { "headline": "{participant} is up against it this week.", "subtext": "Hard stretches are part of the story too." },
        { "headline": "{participant} is finding this week difficult.", "subtext": "Tracking through hard times matters most." },
        { "headline": "{participant} is having one of those weeks.", "subtext": "You're showing up even when it's hard." },
        { "headline": "{participant} is in a hard moment.", "subtext": "Every week of data helps you understand the bigger picture." }
      ]
    },
    {
      "id": "tier2",
      "condition": { "min": 25, "max": 44 },
      "phrases": [
        { "headline": "{participant} is working through it.", "subtext": "Some rough patches — you're tracking what matters." },
        { "headline": "{participant} is having a bumpy week.", "subtext": "Not every week runs smoothly — and that's okay." },
        { "headline": "{participant} is hanging in there.", "subtext": "Progress isn't always linear." },
        { "headline": "{participant} is pushing through.", "subtext": "A mixed week. The data tells the story." },
        { "headline": "{participant} is taking it day by day.", "subtext": "Some weeks are about getting through — and that's enough." },
        { "headline": "{participant} is having a mixed week.", "subtext": "Up and down — that's useful data too." },
        { "headline": "{participant} is in the middle of it.", "subtext": "Below average weeks happen. You're tracking through it." },
        { "headline": "{participant} is persisting through some challenges.", "subtext": "Not every week is a breakthrough." },
        { "headline": "{participant} is making it through a harder week.", "subtext": "Mixed signals — keep logging to see the pattern." },
        { "headline": "{participant} is working through a tougher stretch.", "subtext": "You're paying attention — that's what matters." }
      ]
    },
    {
      "id": "tier3",
      "condition": { "min": 45, "max": 59 },
      "phrases": [
        { "headline": "{participant} is finding their rhythm.", "subtext": "A typical week — steady as they go." },
        { "headline": "{participant} is holding steady.", "subtext": "Nothing dramatic — consistent is good." },
        { "headline": "{participant} is right on track.", "subtext": "Average is a perfectly solid place to be." },
        { "headline": "{participant} is having a balanced week.", "subtext": "Steady and consistent — the foundation of good weeks." },
        { "headline": "{participant} is in a good groove.", "subtext": "Typical and stable — a reliable baseline." },
        { "headline": "{participant} is keeping pace.", "subtext": "Steady week — a great sign of consistency." },
        { "headline": "{participant} is having a pretty normal week.", "subtext": "Steady weeks build the foundation." },
        { "headline": "{participant} is ticking along nicely.", "subtext": "A reliable week. Good baseline data." },
        { "headline": "{participant} is going about their week.", "subtext": "Typical scores across the board this week." },
        { "headline": "{participant} is going at their own pace.", "subtext": "Steady and measured — that's a good week." }
      ]
    },
    {
      "id": "tier4",
      "condition": { "min": 60, "max": 79 },
      "phrases": [
        { "headline": "{participant} is doing well.", "subtext": "A good week overall. Keep it going." },
        { "headline": "{participant} is having a strong week.", "subtext": "A strong week relative to their recent baseline." },
        { "headline": "{participant} is on a good run.", "subtext": "Things are clicking this week." },
        { "headline": "{participant} is in a great stretch.", "subtext": "A good week. Take it one day at a time." },
        { "headline": "{participant} is having a really good week.", "subtext": "The data backs it up — things are going well." },
        { "headline": "{participant} is shining this week.", "subtext": "Strong week on all fronts." },
        { "headline": "{participant} is flourishing.", "subtext": "Well above typical — a week worth noting." },
        { "headline": "{participant} is having a great week.", "subtext": "High marks across the board." },
        { "headline": "{participant} is doing great things.", "subtext": "Strong data this week. Keep the momentum." },
        { "headline": "{participant} is in fine form.", "subtext": "A solid, above-average week." }
      ]
    },
    {
      "id": "tier5",
      "condition": { "min": 80, "max": 100 },
      "phrases": [
        { "headline": "{participant} is thriving.", "subtext": "An excellent week. Keep up the great work." },
        { "headline": "{participant} is having an exceptional week.", "subtext": "Top scores across the board." },
        { "headline": "{participant} is at their best.", "subtext": "A standout week — genuinely excellent." },
        { "headline": "{participant} is having a standout week.", "subtext": "Near-perfect across all dimensions." },
        { "headline": "{participant} is absolutely thriving.", "subtext": "One of the best weeks on record." },
        { "headline": "{participant} is in peak form.", "subtext": "Exceptional data this week." },
        { "headline": "{participant} is having a brilliant week.", "subtext": "Outstanding across the board." },
        { "headline": "{participant} is soaring this week.", "subtext": "This is what a great week looks like." },
        { "headline": "{participant} is on top of the world.", "subtext": "One of the best weeks on record. Take it in." },
        { "headline": "{participant} is having one of their best weeks.", "subtext": "Top-tier across every dimension." }
      ]
    }
  ]
}
```

---

## Acceptance Criteria

- [ ] Hero phrase updates based on the composite weekly score when `summaryResource` has a value.
- [ ] Composite uses mood, focus, and sleep only — energy excluded.
- [ ] All three `latestScore` values being `null` shows the no-data tier phrase.
- [ ] While `summaryResource` is loading, the static placeholder shows — no flicker.
- [ ] If `GET /hero-phrase-tiers` fails or returns 404, the frontend falls back to hardcoded defaults silently.
- [ ] Within a tier, phrase rotates daily by `dayOfYear % 10`.
- [ ] Seeding the Cosmos document causes the API to return live phrases on the next dashboard load.
