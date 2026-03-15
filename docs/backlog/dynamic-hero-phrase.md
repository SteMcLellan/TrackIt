# Dynamic Hero Phrase — Insights Dashboard

**Status:** Ready to implement
**Last updated:** 2026-03-08

---

## Problem

The insights dashboard hero always reads *"{participant} is thriving"* regardless of how the child's week actually went. This can feel tone-deaf when scores are low and hollow when scores are consistently high. Parents need reassurance that's grounded in reality, not a static affirmation.

---

## Proposed Approach

Replace the hardcoded "thriving" and subtitle with score-driven copy derived from the existing `summaryResource` weekly metric data.

### Composite Score

Compute a **composite wellbeing score** from the weekly metric averages:

- Mood, Focus, and Sleep contribute directly (higher = better).
- Energy contributes via deviation from Level (50): `50 - abs(energyScore - 50)`. This maps both extremes (Drained, Wired) to lower composite scores and Level to the maximum contribution.
- Average the four contributions to produce a 0–100 composite.

Use `latestScore` values from `summaryResource` (already computed in the component). If all four `latestScore` values are `null`, treat the week as "no data."

### Phrase Tiers

One phrase pair is selected per render (daily rotation by day-of-year index within the tier). Each tier has 10 options.

#### No Data (all `latestScore` values are `null`)

| # | Hero Phrase | Subtext |
|---|---|---|
| 1 | *"{participant} is your focus this week."* | *"Start logging to see patterns emerge."* |
| 2 | *"{participant} is ready to be understood."* | *"Each reflection adds a piece of the picture."* |
| 3 | *"{participant} is a story in progress."* | *"Logging daily helps you see the patterns."* |
| 4 | *"{participant} is full of patterns to uncover."* | *"A few reflections go a long way."* |
| 5 | *"{participant} is ready when you are."* | *"Daily reflections build the clearest picture."* |
| 6 | *"{participant} is yours to discover."* | *"Every log brings the picture into focus."* |
| 7 | *"{participant} is at the start of something."* | *"Consistent logging reveals patterns over time."* |
| 8 | *"{participant} is worth tracking closely."* | *"Log a few days to start seeing patterns."* |
| 9 | *"{participant} is waiting for your first log."* | *"A week of data reveals what single days can't."* |
| 10 | *"{participant} is just getting started."* | *"Your first reflections are the most important ones."* |

#### Tier 1 — Composite < 25

| # | Hero Phrase | Subtext |
|---|---|---|
| 1 | *"{participant} is having a hard stretch."* | *"Tough weeks happen. Keep showing up."* |
| 2 | *"{participant} is going through a rough patch."* | *"This week was hard — your attention matters."* |
| 3 | *"{participant} is in a challenging season."* | *"Hard weeks have the most to teach."* |
| 4 | *"{participant} is having a tough week."* | *"Hard weeks end. You're not alone in this."* |
| 5 | *"{participant} is struggling right now."* | *"You've been in this — that already counts."* |
| 6 | *"{participant} is navigating some real difficulty."* | *"You're tracking through it — that counts."* |
| 7 | *"{participant} is up against it this week."* | *"Hard stretches are part of the story too."* |
| 8 | *"{participant} is finding this week difficult."* | *"Tracking through hard times matters most."* |
| 9 | *"{participant} is having one of those weeks."* | *"You're showing up even when it's hard."* |
| 10 | *"{participant} is in a hard moment."* | *"Every week of data helps you understand the bigger picture."* |

#### Tier 2 — Composite 25–44

| # | Hero Phrase | Subtext |
|---|---|---|
| 1 | *"{participant} is working through it."* | *"Some rough patches — you're tracking what matters."* |
| 2 | *"{participant} is having a bumpy week."* | *"Not every week runs smoothly — and that's okay."* |
| 3 | *"{participant} is hanging in there."* | *"Progress isn't always linear."* |
| 4 | *"{participant} is pushing through."* | *"A mixed week. The data tells the story."* |
| 5 | *"{participant} is taking it day by day."* | *"Some weeks are about getting through — and that's enough."* |
| 6 | *"{participant} is having a mixed week."* | *"Up and down — that's useful data too."* |
| 7 | *"{participant} is in the middle of it."* | *"Below average weeks happen. You're tracking through it."* |
| 8 | *"{participant} is persisting through some challenges."* | *"Not every week is a breakthrough."* |
| 9 | *"{participant} is making it through a harder week."* | *"Mixed signals — keep logging to see the pattern."* |
| 10 | *"{participant} is working through a tougher stretch."* | *"You're paying attention — that's what matters."* |

#### Tier 3 — Composite 45–59

| # | Hero Phrase | Subtext |
|---|---|---|
| 1 | *"{participant} is finding their rhythm."* | *"A typical week — steady as they go."* |
| 2 | *"{participant} is holding steady."* | *"Nothing dramatic — consistent is good."* |
| 3 | *"{participant} is right on track."* | *"Average is a perfectly solid place to be."* |
| 4 | *"{participant} is having a balanced week."* | *"Steady and consistent — the foundation of good weeks."* |
| 5 | *"{participant} is in a good groove."* | *"Typical and stable — a reliable baseline."* |
| 6 | *"{participant} is keeping pace."* | *"Steady week — a great sign of consistency."* |
| 7 | *"{participant} is having a pretty normal week."* | *"Steady weeks build the foundation."* |
| 8 | *"{participant} is ticking along nicely."* | *"A reliable week. Good baseline data."* |
| 9 | *"{participant} is going about their week."* | *"Typical scores across the board this week."* |
| 10 | *"{participant} is going at their own pace."* | *"Steady and measured — that's a good week."* |

#### Tier 4 — Composite 60–79

| # | Hero Phrase | Subtext |
|---|---|---|
| 1 | *"{participant} is doing well."* | *"A good week overall. Keep it going."* |
| 2 | *"{participant} is having a strong week."* | *"A strong week relative to their recent baseline."* |
| 3 | *"{participant} is on a good run."* | *"Things are clicking this week."* |
| 4 | *"{participant} is in a great stretch."* | *"A good week. Take it one day at a time."* |
| 5 | *"{participant} is having a really good week."* | *"The data backs it up — things are going well."* |
| 6 | *"{participant} is shining this week."* | *"Strong week on all fronts."* |
| 7 | *"{participant} is flourishing."* | *"Well above typical — a week worth noting."* |
| 8 | *"{participant} is having a great week."* | *"High marks across the board."* |
| 9 | *"{participant} is doing great things."* | *"Strong data this week. Keep the momentum."* |
| 10 | *"{participant} is in fine form."* | *"A solid, above-average week."* |

#### Tier 5 — Composite ≥ 80

| # | Hero Phrase | Subtext |
|---|---|---|
| 1 | *"{participant} is thriving."* | *"An excellent week. Keep up the great work."* |
| 2 | *"{participant} is having an exceptional week."* | *"Top scores across the board."* |
| 3 | *"{participant} is at their best."* | *"A standout week — genuinely excellent."* |
| 4 | *"{participant} is having a standout week."* | *"Near-perfect across all dimensions."* |
| 5 | *"{participant} is absolutely thriving."* | *"One of the best weeks on record."* |
| 6 | *"{participant} is in peak form."* | *"Exceptional data this week."* |
| 7 | *"{participant} is having a brilliant week."* | *"Outstanding across the board."* |
| 8 | *"{participant} is soaring this week."* | *"This is what a great week looks like."* |
| 9 | *"{participant} is on top of the world."* | *"One of the best weeks on record. Take it in."* |
| 10 | *"{participant} is having one of their best weeks."* | *"Top-tier across every dimension."* |

### Loading State

While `summaryResource` is loading, keep the existing static phrase (*"is thriving"*) and subtitle as the placeholder — no skeleton or flicker needed for the hero text.

---

## Implementation Notes

### Data-Driven Phrases

Phrases are stored in Cosmos and fetched on each dashboard load so copy can be updated without app changes.

#### Cosmos container

- **Container:** `heroPhraseTiers`
- **Partition key:** `/id`
- **Single document** (id: `"default"`):

```json
{
  "id": "default",
  "tiers": [
    {
      "id": "no-data",
      "condition": "no-data",
      "phrases": [
        { "headline": "{participant} is your focus this week.", "subtext": "Start logging to see patterns emerge." }
      ]
    },
    {
      "id": "tier1",
      "condition": { "min": 0, "max": 24 },
      "phrases": [
        { "headline": "{participant} is having a hard stretch.", "subtext": "Tough weeks happen. Keep showing up." }
      ]
    }
  ]
}
```

#### API endpoint

- **Route:** `GET /hero-phrase-tiers`
- **Auth:** authenticated, no participant scope (global config)
- **Middleware stack:** `errorMiddleware → requestContextMiddleware → authMiddleware`
- Returns the full tiers document as-is.
- Returns `404` if the document does not exist (frontend falls back to hardcoded defaults).

#### Frontend

- Add a `heroPhraseTiersResource` in `insights-dashboard.component.ts` (alongside the existing `summaryResource`).
- Loaded on each dashboard load — no caching.
- If the resource errors or returns no data, fall back to the hardcoded phrase arrays defined in the component.
- `heroPhrase` computed signal reads from `heroPhraseTiersResource` when available, otherwise uses the hardcoded fallback.

### Composite Score

- Composite = `avg(moodScore, focusScore, sleepScore)` — energy excluded (see acceptance criteria).
- Use `latestScore` values from `summaryResource`. All three `null` → no-data tier.

### Phrase Rotation

- Within a tier, select phrase by `dayOfYear % phrases.length` (same phrase all day, rotates daily).

---

## User Interview Findings

Simulated interviews with four parent personas to stress-test the phrase copy. Each persona was presented with phrases across all tiers and asked to react naturally.

---

### Persona 1 — Sarah, parent of Emma (9, ADHD-PI — Inattentive)

**Background:** Emma was diagnosed at 7. She's well-liked, never disruptive — she just drifts. Sarah describes her as "the kind of kid who can disappear in a full room." Emma's focus scores are chronically low; mood and sleep are typically mid-range. Sarah has been navigating this for years and is past the "just discovered" phase.

> **On "Emma is working through it" showing up every week:**
> "It feels vague. Emma is always working through it — that's just her life. If I see that on good weeks and bad weeks, I don't know what it's actually telling me."

> **On "Noticing it is the first step" (Tier 1 subtext):**
> "I've been noticing for two years. That feels like something you'd say to someone who just found out their kid has ADHD. I'm way past that."

> **On "Emma is grinding through the week" (Tier 2, #9):**
> "No. Emma doesn't grind — she drifts. She daydreams. 'Grinding' is a hyper kid who can't stop moving. Emma is the opposite."

> **On "Emma is holding steady" (Tier 3):**
> "That's actually kind. With an inattentive kid, holding steady is genuinely hard. They work twice as hard to look half as put-together."

> **On Tier 3 subtexts generally:**
> "I'd rather the phrase honor the effort without implying improvement. 'Finding her rhythm' sounds like she's getting better. She's not necessarily — she's just managing."

**Key tensions:**
- Inattentive children's baseline composite will chronically land in Tier 2 (low focus score drags it down), making "working through it" feel like a description of permanent life, not a bad week.
- "Grinding" is hyperactive-coded and doesn't fit the inattentive presentation.
- "Noticing it is the first step" is condescending to experienced caregivers.
- Tier 3 phrases should honor effort without implying trajectory or progress.

---

### Persona 2 — Marcus, parent of Jaylen (8, ADHD-PH — Hyperactive-Impulsive)

**Background:** Jaylen was diagnosed at 5. Marcus describes parenting him as "loving a live wire." Jaylen's energy is consistently in the Wired range (~85). He has a huge personality, a short fuse, and a lot of behavioral incidents.

> **On the structural composite problem (energy permanently depressing scores):**
> "If the app treats his high energy as a problem every single week, it's going to feel like the app has already decided Jaylen's a problem child. That's not what I want to see when I open the dashboard."

> **On "Noticing it is the first step" (Tier 1 subtext):**
> "[Sighs.] We've been noticing since he was three. When I see that, I want to close the app. I'm way past step one. Give me step six."

> **On what would land better in a hard week:**
> "Make me feel like the rough patch is useful, not just survivable. 'Hard weeks have the most to teach' — something like that."

> **On "Keep the momentum" and "Savor it" (Tier 4/5 subtexts):**
> "'Keep the momentum' makes me anxious. Good stretches for Jaylen can turn fast. 'Savor it' is worse — it sounds like I should enjoy it before it ends. I don't want to be reminded it might end while I'm celebrating."

**Key tensions:**
- **Structural flaw:** Wired energy (~85) contributes only ~15 to the composite (`50 - abs(85-50) = 15`). A child with mood 60, focus 50, sleep 50, energy 85 computes to composite 43.75 — Tier 2 — even on a genuinely good week. Hyperactive children may be structurally locked out of Tier 4/5.
- "Noticing it is the first step" fails again — universally condescending to experienced parents.
- Forward-projecting subtexts ("keep the momentum," "savor it") heighten anxiety for parents anticipating the next hard patch.
- Hard week subtexts should frame difficulty as data-rich, not just survivable.

---

### Persona 3 — Priya, parent of Dev (11, ADHD-C — Combined Type)

**Background:** Dev has a sharp mind, quick temper, and tendency to catastrophize. Priya is a detail-oriented accountant who values precision over comfort. She's done significant reading and therapy. She's skeptical of vague reassurance.

> **On "Dev is having a pretty normal week" (Tier 3, #7):**
> "I'd appreciate that honesty. A normal week for Dev is genuinely hard-won."

> **On "Steady weeks are worth celebrating too" (Tier 3, #7 subtext):**
> "Slightly cheerleader energy. Just tell me it's normal — I don't need to be told to celebrate it. That's my call."

> **On "Dev is in their element" (Tier 3, #9):**
> "'In their element' implies he's in a situation that suits him. An average week isn't that. It makes me think he's doing his favorite thing. That's not what a 50th percentile week is."

> **On "Above average across the board" (Tier 4, #2 subtext):**
> "Compared to neurotypical kids? To his own history? If you're going to reference data, be specific about what the comparison is."

> **On "Difficult stretches are part of the journey" (Tier 1, #3 subtext):**
> "'Part of the journey' has lost all meaning from therapeutic settings. It doesn't acknowledge that *this specific stretch* is hard — it just categorizes it as a thing that happens."

**Key tensions:**
- "Worth celebrating" and other motivational nudges feel patronizing to experienced, self-aware parents.
- "In their element" is semantically wrong for an average week — it implies optimal context, not baseline function.
- "Above average across the board" is ambiguous: neurodivergent parents are sensitive to unspecified comparison baselines.
- "Part of the journey" is filler — it categorizes difficulty without acknowledging it.
- Prefers honest acknowledgment over emotional management.

---

### Persona 4 — Claire, parent of Mia (10, ADHD-C + Anxiety)

**Background:** Mia has combined-type ADHD and generalized anxiety disorder. She masks well at school and unravels at home. Claire is a nurse, hypervigilant, and deeply attuned to Mia's hidden states. Sleep and mood scores are often low; the app data doesn't capture the masking.

> **On whether the phrase should reflect the data vs. lived reality:**
> "The app only knows what I tell it. If I'm logging and Mia seems okay in the scores but I know she cried for an hour before bed, 'finding her rhythm' would feel like a slap. Like the app doesn't know the half of it."

> **On "Mia is in a great stretch — enjoy it" (Tier 4, #4 subtext):**
> "'Enjoy it' makes me feel sick. Not because it's mean, but because the moment I let myself enjoy it, I start bracing for when it stops. Anxiety parents don't enjoy good stretches the same way. We hold them carefully."

> **What would work better:**
> "'A good week. Take it one day at a time.' That honors the present without projecting."

> **On "Noticing it is the first step" (Tier 1, #5 subtext):**
> "[Quietly.] I've been noticing for four years."

> **On no-data language — "Mia is waiting for your first log" (#5):**
> "If I haven't logged, it's because things were bad and I didn't have the energy. The last thing I need is her 'waiting' for me. Something like 'Come back when you're ready' would make me feel like the app is on my side."

**Key tensions:**
- "Enjoy it" / "Savor it" are worse than neutral for anxiety-adjacent parents — they imply impermanence and trigger dread.
- The app overcommits to the data: parents who know their child masks need language that holds scores more lightly ("here's what the week showed" rather than definitive assessments).
- No-data guilt: "waiting for your first log" creates guilt for parents who didn't log because things were too hard. The no-data tier needs to be entirely non-pressuring.
- "Noticing it is the first step" fails for the fourth time.

---

### Synthesis & Recommended Copy Changes

#### Issues requiring copy changes

| Issue | Affected items | Recommendation |
|---|---|---|
| "Noticing it is the first step" is condescending | Tier 1, #5 subtext | Replace with: *"You've been in this — that already counts."* |
| "Grinding through the week" is hyperactive-coded | Tier 2, #9 | Replace with: *"{participant} is making it through a harder week."* |
| "Difficult stretches are part of the journey" is filler | Tier 1, #3 subtext | Replace with: *"Hard weeks have the most to teach."* |
| "Enjoy it" / "Savor it" trigger anxiety | Tier 4 #4, Tier 5 #9 subtexts | Replace with present-tense framing: *"A good week. Take it one day at a time."* / *"One of the best weeks on record. Take it in."* |
| "In their element" misreads what average means | Tier 3, #9 | Replace with: *"{participant} is going about their week."* |
| "Worth celebrating too" is patronizing | Tier 3, #7 subtext | Replace with: *"Steady weeks build the foundation."* |
| "Waiting for your first log" creates guilt | No-data, #5 | Replace with: *"{participant} is ready when you are."* (swap with existing #9) |
| "Above average across the board" is ambiguous | Tier 4, #2 subtext | Replace with: *"A strong week relative to their recent baseline."* |
| "Part of the journey" is therapeutic filler | Tier 1, #3 subtext | See "Difficult stretches" fix above |

#### Structural issue requiring design decision

**Energy non-monotonic composite bias:** A child with consistently Wired energy (~85) contributes only ~15 to the composite (`50 - abs(85-50)`), regardless of how good mood, focus, and sleep are. This structurally locks hyperactive-impulsive children into Tier 2, potentially every week. Parents of these children will distrust a system that never shows their child having a good week.

Three options:

| Option | Description | Trade-off |
|---|---|---|
| **A — Exclude energy from composite** | Composite = avg(mood, focus, sleep). Energy is non-monotonic and already surfaced elsewhere in the dashboard. | Simpler, avoids the structural problem. Loses energy as a wellbeing signal in the hero. |
| **B — Cap energy's downward contribution** | Energy contributes its deviation penalty at most 50% weight: `50 - abs(score - 50) * 0.5`. Wired at 85 → contributes 32.5 instead of 15. | Partial mitigation; still penalises extremes but less harshly. |
| **C — Keep current formula, document the limitation** | No change to formula. Note in the UX that the composite reflects all four dimensions including energy regulation. | Honest but will frustrate parents of hyperactive kids. |

**Recommendation: Option A** — the hero phrase is primarily about emotional and cognitive wellbeing state, not energy regulation. Energy dysregulation is already surfaced in the weekly metric cards. Excluding it from the composite avoids permanent bias without losing information.

---

## Acceptance Criteria

- [ ] Phrase tiers are loaded from `GET /hero-phrase-tiers` on each dashboard load; if the fetch fails or returns no data, the component falls back to hardcoded defaults.
- [ ] Hero headline and subtitle update based on the composite weekly score when `summaryResource` has a value.
- [ ] Composite is computed from mood, focus, and sleep only — energy is excluded (Option A: avoids structural bias against hyperactive-impulsive children; energy dysregulation is surfaced separately in the metric cards).
- [ ] All four `latestScore` values being `null` shows the "no data" variant.
- [ ] While `summaryResource` is loading, the hero shows the default static phrase (no flicker).
- [ ] Six tiers are used as specified above (no data + 5 score bands).
- [ ] Within a tier, phrases rotate daily by day-of-year index (same phrase all day, different each day).
