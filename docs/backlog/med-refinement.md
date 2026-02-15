# Medication UX: Split Insights from Logging

**Status:** Exploring — needs Stitch design pass
**Last updated:** 2026-02-14

## Problem

The `/insights` dashboard currently serves two fundamentally different interaction modes:

1. **Insight/overview** — Weekly Rhythms, latest Behavioral Moment, Daily Reflection entry. Read-oriented, scannable, emotionally supportive.
2. **Active task completion** — Swipe-to-mark-taken, time editing, as-needed dose logging, scheduled vs as-needed grouping. A CRUD workflow.

The medication logging section ("Today's Routine") is visually heavy and operationally complex — it accounts for roughly half the code in `insights-dashboard.component.ts` (~2,000 lines). No amount of visual softening fixes the fact that a swipe-to-act medication checklist is a different UX intent than "here's how your child is doing."

## Proposed Direction

### /insights becomes read-only for medications

- Show medication adherence as a **compact read-only signal** — e.g. "2/3 doses today" as a summary card or chip, similar in weight to the Weekly Rhythms cards.
- At-a-glance status only. No interaction surface for logging.
- Tap could navigate to the dedicated medication page for details.

### Dedicated /medications route for logging

- Owns the full medication logging workflow: swipe-to-act, time editing, scheduled vs as-needed grouping.
- Replaces the legacy medication pages (currently being removed).
- Gets the focused UX it deserves without competing for attention on insights.

## Benefits

- **Insights stays insight-shaped.** Every section becomes read-oriented and scannable.
- **Component complexity drops.** The insights dashboard sheds ~1,000 lines of swipe/save/edit machinery.
- **Medication logging gets room to grow.** Multi-dose support, dose labeling (see open question in `docs/product-specs/medication-frequency.md`), and history views can live here without bloating insights.

## Next Steps

1. **Stitch design pass** — Generate screens for both surfaces:
   - Insights: medication adherence summary card (read-only)
   - Medications: full logging page with routine management
2. Decide on bottom nav treatment — does `/medications` get its own nav tab, or is it accessed from insights/profile?
3. Extract medication logging logic from `InsightsDashboardComponent` into the new route.

## Related Docs

- `docs/product-specs/medication-frequency.md` — frequency model and dose labeling open question
- `docs/backlog/eventindex-architecture.md` — related data model concerns for medication logs
- `DESIGN.md` — visual patterns for cards and chips

---

## Simulated Usability Interview

Role-played conversation between a parent user (Alex) and a UX researcher (Jordan), exploring the implications of the proposed split. Generated 2026-02-14.

**Participants:**
- **Alex** — Parent of a 9-year-old with ADHD, daily TrackIt user for ~3 months
- **Jordan** — UX Designer / Researcher

---

**JORDAN:** Alex, thanks so much for making time for this. Before we jump into anything specific, I'd love to just hear about your morning. Walk me through what happens when you open TrackIt on a typical day.

**ALEX:** Sure. So my alarm goes off at 6:45. I get my son Eli ready for school. His Concerta -- that's his stimulant -- needs to go with breakfast, so I give it to him, then I open TrackIt while he's eating cereal. I swipe the Concerta to "taken" right there at the kitchen table. Then I scroll up and glance at the weekly rhythm cards -- mood, focus, sleep, energy. That's become kind of my morning check-in with myself. Like, how are we actually doing this week? Then I close the app and we're out the door.

**JORDAN:** And when do you come back to it?

**ALEX:** Usually around 8 PM after Eli's in bed. That's when I do the daily reflection -- the mood, focus, sleep, energy sliders. Sometimes I log the melatonin if he needed it that night. And if there was a behavioral moment during the day, I'll log that too, though honestly I try to do those in the moment because I forget the details later.

**JORDAN:** So the app gets two distinct visits -- a quick morning task and a longer evening session. When you open the insights page in the morning, what's the first thing your eyes go to?

**ALEX:** Honestly? The hero text. "Eli is thriving." I know it's probably just a placeholder or whatever, but it sets my emotional tone. Some mornings when things have been rough -- like we had a terrible focus week recently -- seeing "thriving" felt almost sarcastic. But most days it's nice. After that I scroll down to the weekly rhythm cards. Those little sparklines are genuinely useful. I can see at a glance if sleep has been trending down, which usually predicts a bad focus week.

**JORDAN:** That's really interesting -- you're reading the sparklines as predictive, not just historical. Let me shift to the medication section, "Today's Routine." How does that part feel to you day-to-day?

**ALEX:** It's fine. It works. But it feels like a different app, you know? The top of the page is this calm, reflective, "here's how your kid is doing" space. And then suddenly there's this chunky card with swipe actions and time editors and "Scheduled" versus "As Needed" groupings. It's like someone stapled a to-do list to a wellness journal.

**JORDAN:** That's a vivid way to put it. The backlog doc we've been looking at actually uses similar language -- "two different interaction modes." Can you tell me more about the swipe interaction specifically?

**ALEX:** The swipe itself is satisfying, actually. There's something about physically swiping right and seeing that green "Taken" chip appear. It feels like checking something off. My issue is more... contextual. When I'm in "morning medication mode," I don't want to see sparklines and behavioral moments. I want to see: did Eli take his meds? What time? Done. And when I'm in "evening reflection mode," I don't want to accidentally bump a medication row while I'm scrolling past it to get to the daily reflection button.

**JORDAN:** Has that actually happened -- accidentally interacting with a medication row?

**ALEX:** Twice. Once I was scrolling and my thumb caught the Concerta row and it registered a swipe. It went to "Not Taken" and I panicked because I'd already logged it that morning. I had to swipe it back to "Taken" and re-enter the time. The second time was with melatonin -- I accidentally logged a dose for a night when he didn't need it, and I had to swipe left on the event row to delete it. That whole interaction of "swipe left on the little sub-row to remove an as-needed log" -- that took me a while to discover. I didn't even know you could do that for the first month.

**JORDAN:** That's a really important data point. The swipe-to-delete on as-needed event rows isn't obvious. Let me ask about the "twice daily" situation specifically. Eli's stimulant is twice daily -- how does that work for you in the current UI?

**ALEX:** This is my biggest frustration, honestly. So Concerta shows up as one row that says "Twice daily." When I swipe it in the morning, it says "Taken" with a green chip. Great. But what about the second dose? There's no second row. It just says "Twice daily" in the subtitle, and the row is already green from the morning dose. So I have to mentally remember that the evening dose isn't tracked separately. I've brought this up in my own head a hundred times. The app says "Taken" but I know it means "one of two doses taken." That's not the same thing.

**JORDAN:** So when you see that green "Taken" chip after the morning dose, what does "adherence" mean to you at that point?

**ALEX:** It means nothing, really. Or it means "partially done." If someone asked me "is Eli adherent today?" I'd say "he took his morning dose." The green chip is lying to me, in a nice way. What I actually want is something like "1 of 2" -- a fractional view. Even just "1/2 doses" would be more honest than a binary taken/not-taken for a twice-daily med.

**JORDAN:** That's a strong finding. Let me ask about the as-needed side -- the melatonin. How does that section work for you?

**ALEX:** The as-needed section is actually better designed in some ways. I swipe right on the melatonin base row, it creates a new event entry with a timestamp. If he needs another dose -- which he never does, but theoretically -- I could swipe again. The problem is it feels heavy for what it is. Melatonin is a simple thing. He either took it or he didn't. I don't need the full swipe-and-log ceremony for it. A toggle would be fine. The swipe pattern makes sense for something with multiple doses or complex timing, but for a single as-needed med, it's overkill.

**JORDAN:** Here's a question that might surprise you. We're considering moving the entire medication logging workflow off the insights page and onto its own dedicated medications page. The insights page would just show a compact summary -- something like "2 of 3 doses today" -- and you'd tap it to go to the full logging view. How does that land for you?

**ALEX:** (pauses) My first reaction is relief. Like, yes, get the checklist off my wellness dashboard. But then my second reaction is... wait, that adds a tap. Right now I open the app, scroll down a little, and swipe. If meds move to a separate page, I have to open the app, read the summary, tap it, wait for the page to load, then swipe. That's one more step in a workflow I do while holding a cereal bowl and telling a 9-year-old to put his shoes on.

**JORDAN:** That's a real tension. Speed of the current flow versus clarity of separation. If you had to choose, which matters more?

**ALEX:** Clarity. Actually, no, let me revise that. It depends on the entry point. If medications had its own tab in the bottom nav -- like, I open the app and tap a pill icon and I'm immediately in logging mode -- that's actually faster than scrolling down the insights page. I'd go directly there in the morning. The insights page is what I look at in the evening when I want the "how are we doing" view. So yes, split them, but make the medications page a first-class destination, not something buried behind a tap on a summary card.

**JORDAN:** That's a really clear articulation. So you'd essentially have two entry points into the app depending on your intent -- a morning "task mode" via the medications tab, and an evening "reflection mode" via insights.

**ALEX:** Exactly. And honestly, the insights page would be so much calmer without the routine card. Just the hero text, the weekly rhythms, the daily reflection button, and the latest behavioral moment. That's a page I'd enjoy spending 30 seconds on in the evening. Right now it's this long scroll with the medication section taking up like half the screen, especially when Eli has event logs showing under melatonin.

**JORDAN:** You mentioned the "+N more" overflow on as-needed events. Does that come up for you?

**ALEX:** Not with melatonin since he only takes it once if he takes it. But I could see it being relevant for -- actually, here's something your team maybe hasn't thought about. We tried giving Eli a magnesium supplement for a while, also as-needed. So I had two as-needed medications. The as-needed section became this big block with two base rows and their event sub-rows, and it was visually confusing. I couldn't tell at a glance which events belonged to which med. The indentation helps, but on a phone screen, it all blurs together. I ended up removing magnesium from TrackIt and just tracking it on paper because the UI was getting too cluttered.

**JORDAN:** That's a really important signal -- that the current design's visual density actually caused you to stop tracking a medication in the app. Did you feel like you lost anything by tracking it on paper instead?

**ALEX:** I lost the connection to everything else. The whole point of TrackIt is that you see medications alongside mood alongside sleep alongside behavior. When magnesium went to paper, I couldn't correlate it with anything. I just had a sticky note on the fridge. The data was orphaned.

**JORDAN:** Let me come back to the summary card idea. If the insights page showed something like "2/3 doses today" for medications, what information would you need in that compact view to feel confident things are on track?

**ALEX:** The fraction is the most important thing. "2/3 doses" tells me morning Concerta is done, one thing is still pending. I'd also want to know what's pending -- not just a number, but "evening Concerta" or whatever. Maybe a small line of text like "2/3 -- Concerta PM pending." And color coding: green if everything's done, yellow if something is pending but it's still early enough in the day, maybe grey if a dose was skipped. I don't want red. Red feels judgmental. This isn't a failure, it's a busy Tuesday.

**JORDAN:** "Red feels judgmental" -- I'm writing that down. Let me ask one more thing. The time editing feature -- when you tap the time on a taken medication to change it. How often do you use that?

**ALEX:** Rarely. Maybe once a week. It's for when I forget to log in the morning and I do it at lunch -- I go back and set the time to 7:15 AM or whenever he actually took it. The interaction itself is fine, the little time input pops up. But here's the thing -- when I'm doing that retroactive edit, I'm already in a "fixing a mistake" mindset. I wouldn't mind being on a separate medications page for that. It's a deliberate action, not a quick swipe. So that actually supports the split. Quick swipes in the morning on the medications page, time corrections later on the same page, and the insights page stays clean.

**JORDAN:** That's a useful distinction between "quick capture" and "correction" as two sub-modes within medication logging, both of which belong away from insights. One last question before we wrap up. If we make this split, is there anything on the current insights page that you'd genuinely miss?

**ALEX:** I'd miss seeing the green checkmarks on the same screen as the sparklines. There's something psychologically reinforcing about looking at the page and seeing "mood is balanced, focus is steady, and all meds are taken." It's like a little report card. If meds move away, that connection becomes implicit -- I have to remember that I already checked meds on another tab. So the summary card on insights would need to carry that emotional weight. Not just "2/3 doses" but something that feels like a warm signal. Like a green chip that says "All on track" or a gentle "1 remaining." Something that gives me the same feeling without the full checklist.

**JORDAN:** That's really valuable, Alex. Let me summarize what I'm taking away from this conversation:

1. **The insights page serves two distinct emotional modes** -- morning task completion and evening reflection -- and the medication logging section creates friction in both because it belongs to neither.

2. **The "Taken" chip on twice-daily medications is misleading.** It shows binary status when the reality is fractional. "1 of 2 doses" is a more honest representation, and dishonest status signals erode trust over time.

3. **Swipe-to-act works well as an interaction pattern but is poorly discoverable for secondary actions** like deleting an as-needed event log. Users may go a month without finding it.

4. **A dedicated medications tab in the bottom nav would actually be faster** than the current scroll-to-routine-card flow, not slower, contradicting the assumption that separation adds friction.

5. **Visual density of the as-needed section drives users away from tracking.** Alex stopped tracking a medication in the app because the UI got too cluttered with multiple as-needed meds and their event sub-rows.

6. **The compact summary card on insights needs to carry emotional weight, not just data.** "All on track" versus a raw fraction. Color coding should avoid red -- yellow/green/grey feel more supportive.

7. **Time editing is a "correction mode" action** that users are willing to do on a separate page, further supporting the split.

8. **The sparkline cards are being used predictively**, not just historically -- sleep trends predict focus. That's a usage pattern worth designing around.

Does that feel accurate?

**ALEX:** That's pretty much it, yeah. I'd add one thing -- don't underestimate how much the morning workflow matters. If the medications page takes even one extra second to load compared to scrolling on insights, I'll notice. Parents of kids with ADHD are already managing a hundred things before 7 AM. Speed is kindness.

**JORDAN:** "Speed is kindness." I love that. Thank you, Alex. This has been incredibly helpful.

**ALEX:** Happy to help. Just make the app better for the mornings. That's when we need it most.

---

### Key Takeaways for Design

1. **Fractional dose status is mandatory** — binary taken/not-taken is dishonest for multi-dose medications
2. **Bottom nav tab for medications** — faster than scroll-to-section, supports morning "task mode" intent
3. **As-needed visual density** — multiple as-needed meds with event sub-rows caused a user to abandon in-app tracking
4. **Summary card tone** — use "All on track" / "1 remaining" language; avoid red (judgmental); green/yellow/grey palette
5. **Swipe-to-delete discoverability** — secondary actions need clearer affordance on the dedicated page
6. **Speed is kindness** — the medications page must load instantly; parents are multitasking under pressure
7. **Sparklines are predictive** — users correlate sleep trends with focus outcomes; design around this
