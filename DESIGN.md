# Design System: TrackIt
**Project ID:** 2002730124455423542

> Synthesized from screens: "TrackIt Trendline Logo Identity (SignIn)" and "Parental Insight Dashboard"

---

## 1. Visual Theme & Atmosphere

TrackIt operates across two complementary visual modes that serve distinct emotional contexts.

The **identity/sign-in surface** is clean and calm — a white backdrop with a three-line wavy logo mark rendered in the three core semantic colors (Vital Emerald, Electric Violet, Energetic Amber). It signals trust and focus, stripping away distraction at the point of entry.

The **dashboard surface** is airy and clinical-light — a near-white canvas that gives breathing room to richly colored data points. It communicates "this is a safe, organized space." The palette shifts from decorative to informational: each color carries a semantic role (mood, focus, sleep, energy), and gentle iOS-style drop shadows lift card containers just enough to create depth without drama.

Overall aesthetic: **Calm-tech. Data-rich but not dense. Caring, not clinical.**

---

## 2. Color Palette & Roles

### Core Semantic Colors (used across ALL screens)

These three colors form the shared visual language of the TrackIt brand. They appear in the logo mark on the SignIn screen and as semantic data indicators on the Dashboard.

| Descriptive Name | Hex | Logo Line | Dashboard Role |
|---|---|---|---|
| Vital Emerald | `#10b981` | Top wavy line | Wellness / mood / sleep positive indicators |
| Electric Violet | `#8b5cf6` | Middle wavy line | Behavioral moment (ABC) tagging and categorization |
| Energetic Amber | `#f59e0b` | Bottom wavy line | Energy / caution metric indicators |

### Surface & Layout Colors

| Descriptive Name | Hex | Role |
|---|---|---|
| Ghost White Canvas | `#fcfcfd` | Primary light background (dashboard and sign-in) |
| Midnight Slate | `#1e293b` | Primary body and heading text on light surfaces |
| Signal Blue | `#137fec` | Project accent; interactive elements, links, selected states |
| Sky Azure | `#0ea5e9` | Focus and cognitive metric indicators (dashboard only) |

### Brand-Only Colors

| Descriptive Name | Hex | Role |
|---|---|---|
| Mint Pulse | `#13ec92` | Defined as Tailwind `primary`; used for dot-grid background overlay on SignIn — not part of the logo mark |
| Deep Forest Night | `#10221a` | Dark surface background variant; reserved for dark-mode surfaces |

---

## 3. Typography Rules

- **Font family:** Inter (sans-serif) exclusively across both surfaces
- **Display / Brand heading:** Heavy weight (700–900), large scale, letter-spacing tightened — creates a confident, modern wordmark feel
- **Section headings:** Medium-bold (600), standard tracking
- **Body / data labels:** Regular (400), modest size — legibility-first, never decorative
- **Taglines:** Lighter weight italic or regular — understated, supportive of the brand mark rather than competing with it
- **Icon typography:** Material Symbols Outlined, configured with `font-variation-settings` for fine weight control; icons are treated as semantic glyphs not decorative elements

---

## 4. Component Stylings

- **Buttons:** Pill-shaped (fully rounded, `border-radius: 9999px`), filled with Mint Pulse (`#13ec92`) for primary actions; ghost/outline style for secondary actions. Minimum 44px touch target height.

- **Cards / Containers:** Gently curved corners (8px radius, equivalent to Tailwind `rounded-lg`). On the light dashboard surface, cards sit on Ghost White Canvas with whisper-soft diffused shadows (`0 4px 24px -2px rgba(0,0,0,0.05)`) — barely-there elevation. No heavy borders.

- **Data / Metric Chips:** Small pill-shaped tags using semantic data colors (Vital Emerald, Sky Azure, Energetic Amber, Electric Violet) as background tints with matching text. These visually encode category at a glance.

- **Brand Logo Mark:** Three parallel wavy SVG paths stacked vertically, each rendered as a solid 8px stroke: Vital Emerald (`#10b981`) on top, Electric Violet (`#8b5cf6`) in the middle, Energetic Amber (`#f59e0b`) on the bottom. The three lines together represent the rhythm of tracked data over time — mood, behavior, and energy in a single mark.

- **Inputs / Forms:** Rounded corners (8px), light stroke border on a slightly off-white background. Focused states use Signal Blue (`#137fec`) as a border highlight.

---

## 5. Layout Principles

- **Mobile-first, single column:** All screens are designed for 390px viewport width (iPhone 14 form factor). Content stacks vertically with generous vertical rhythm.
- **Generous whitespace:** The dashboard breathes. Sections are separated by substantial padding rather than divider lines — the white space itself creates hierarchy.
- **Edge-to-edge safe zones:** Content respects horizontal padding (approximately 16–20px gutters) to ensure nothing clips on smaller screens. No horizontal scrolling.
- **Sticky / anchored primary actions:** Key CTAs (like "Sign In") are positioned within thumb reach — lower third of the screen on mobile.
- **Data grid for metrics:** Dashboard weekly summaries use a compact horizontal grid of color-coded chips/badges — scannable at a glance, not requiring deep reading.
- **Scrollable content areas use `.no-scrollbar`:** Overflow content scrolls without visible scrollbar chrome, maintaining the clean aesthetic.
