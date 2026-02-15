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
| Signal Blue | `#137fec` | Project accent; links, selected states, and focus rings (not primary CTA fill) |
| Sky Azure | `#0ea5e9` | Focus and cognitive metric indicators (dashboard only) |
| Soft Violet | `#f5f3ff` | Section tint for behavior/function containers and profile accent surfaces |
| Soft Amber | `#fffbeb` | Section tint for antecedent containers and warm contextual grouping |
| Soft Emerald | `#ecfdf5` | Section tint for consequence/success containers |
| Soft Azure | `#f0f9ff` | Section tint for place/context containers and informational grouping |

### Brand-Only Colors

| Descriptive Name | Hex | Role |
|---|---|---|
| Mint Pulse | `#13ec92` | Brand accent reserved for the SignIn dot-grid background overlay; not part of the logo mark and not used for primary CTA fills |
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

- **Buttons:** Pill-shaped (fully rounded, `border-radius: 9999px`), filled with Vital Emerald (`#10b981`) for primary actions (standardized to match Dashboard "Taken"); ghost/outline style for secondary actions. Minimum 44px touch target height.

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

---

## 6. Canonical Page Shell (Top + Bottom)

Use this shell by default on authenticated mobile screens unless a flow explicitly requires a different structure.

### Top App Bar (Canonical)

- **Header container class tokens (required):**
  - `flex items-center bg-white/90 backdrop-blur-md p-4 pb-3 justify-between sticky top-0 z-30 border-b border-slate-100`
- **Left brand cluster (required):**
  - Outer wrapper: `flex items-center gap-2.5`
  - Inner wrapper: `flex items-center gap-0.5 h-6`
  - Keep the TrackIt 3-wave SVG logo with these exact path geometries:
    - `M2 14C4 14 6 8 8 10C10 12 12 6 14 6`
    - `M5 16C7 16 9 10 11 12C13 14 15 8 17 8`
    - `M8 18C10 18 12 12 14 14C16 16 18 10 20 10`
  - Wordmark text treatment: `text-slate-900 font-bold text-lg tracking-tight`
- **Right action cluster (required):**
  - Wrapper: `flex items-center gap-2`
  - Notifications button:
    - `flex size-9 cursor-pointer items-center justify-center rounded-full bg-white border border-slate-100 text-slate-400`
    - Icon name/class: `notifications` with `text-xl`
  - Account control:
    - `text-energetic-violet flex size-9 shrink-0 items-center justify-center rounded-full bg-soft-violet border border-violet-100`
    - Icon name/class: `account_circle` with `text-xl leading-none`
- **Do not:**
  - Replace `size-9` with `w-9 h-9`
  - Replace `account_circle` with `person`
  - Replace `text-xl` with `text-[20px]`
  - Add dark-mode variants unless explicitly requested

### Bottom Navigation (Canonical)

- **Nav container class tokens (required):**
  - `fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-10 py-5 pb-8 flex justify-between items-center z-50`
- **Information architecture and order (required):**
  1. `Insights` icon `insights`
  2. `Timeline` icon `calendar_today`
  3. `Profile` icon `settings`
- **Item treatment:**
  - Each item uses: `flex flex-col items-center gap-1.5`
  - Icon size: `text-[26px]`
  - Label: `text-[9px] font-bold uppercase tracking-tighter`
  - Active tab color: `text-energetic-violet` and active icon includes `fill-1`
  - Inactive tabs: `text-slate-400`
- **Safe area / mobile behavior:**
  - Keep bottom padding token `pb-8` on nav
  - Ensure page content has enough bottom spacing to avoid overlap with fixed nav

### Shell Parity Checklist

Use this before accepting a Stitch screen update:

1. Top app bar matches canonical class tokens, icon names, and SVG path geometry.
2. Bottom nav matches canonical container tokens, item order, icons, and active/inactive states.
3. Screen remains mobile-first at 390px width, with no horizontal overflow.
