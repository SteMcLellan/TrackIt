# Page Shell Architecture

Defines the component structure, routing layout, and responsibilities for TrackIt's authenticated page shell — the persistent frame shared across all main screens.

---

## Shell Anatomy

Every authenticated screen in TrackIt shares a three-zone layout, as established in the Stitch designs:

```
┌─────────────────────────────┐
│         Top Bar             │  sticky, z-30, bg-white/90 backdrop-blur
├─────────────────────────────┤
│                             │
│       Page Content          │  scrollable, fills available height
│                             │
├─────────────────────────────┤
│        Bottom Nav           │  fixed, z-50, bg-white/95 backdrop-blur
└─────────────────────────────┘
```

The login/sign-in screen is the only surface that opts out of this shell entirely.

---

## Routing Structure

Use **nested routing** to scope the shell to authenticated routes. `AppComponent` owns only the root router outlet. The shell is a dedicated layout component rendered as the authenticated route's parent.

```
AppComponent  (root <router-outlet> only)
├── /login        → LoginComponent            (no shell)
└── /             → ShellComponent            (authenticated shell)
    ├── /insights     → InsightsDashboardComponent
    ├── /timeline     → TimelineComponent
    ├── /profile      → ProfileComponent
    ├── /log          → BehaviorLogComponent
    └── ...
```

**Why nested routing over a global shell with conditional visibility:**
- Shell visibility is expressed structurally in the route config, not via computed route-sniffing logic inside components
- Adding a shell-free route in the future (e.g. an onboarding flow) requires no changes to shell components
- Route guards (`ActiveParticipantGuard`) attach cleanly to the shell's route, protecting all children at once

---

## Components

### `ShellComponent`

**Path:** `frontend/src/app/shared/ui/page/shell.component.ts`
**Responsibility:** Layout glue only. Composes the three zones and provides the content safe zone. Contains no business logic.

```
ShellComponent
├── TopBarComponent
├── <main> (router-outlet for page content)
└── ShellBottomNavComponent
```

Key implementation notes:
- `<main>` must have `padding-bottom` large enough to clear the fixed bottom nav plus `env(safe-area-inset-bottom)`. Use a CSS custom property `--bottom-nav-clearance` set by `ShellBottomNavComponent` if dynamic height is needed, or hardcode based on the canonical nav height (approx 80px with safe area).
- `ShellComponent` itself should have no padding or background — those are the responsibility of individual page components and the top/bottom bars.

---

### `TopBarComponent`

**Path:** `frontend/src/app/shared/ui/page/top-bar.component.ts`
**Responsibility:** Renders the canonical sticky header from the Stitch design system.

**Layout (left → right):**
- Left cluster: TrackIt 3-wave SVG logo + "TrackIt" wordmark
- Right cluster: notifications icon button + account circle icon button

**Design tokens (from `DESIGN.md`):**
- Container: `sticky top-0 z-30 flex items-center justify-between bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3`
- Notifications button: `min-w-11 min-h-11 rounded-full bg-white border border-slate-100 text-slate-400`, icon: `notifications` (Material Symbols Outlined)
- Account button: `min-w-11 min-h-11 rounded-full bg-soft-violet text-energetic-violet`, icon: `account_circle`

**Inputs/Outputs:**
- No inputs required at launch — the bar is static branding + fixed navigation
- Notifications button: emit `notificationsClicked` output (functionality TBD, placeholder for now)
- Account button: navigate to `/profile` via `Router.navigate()`

**Note:** The top bar does not display participant name or contextual page titles. Per the Stitch designs, those belong in the page content area if needed.

---

### `ShellBottomNavComponent`

**Path:** `frontend/src/app/shared/ui/page/bottom-nav.component.ts`
**Responsibility:** Fixed three-tab navigation. Active tab derived from current route.

**Information architecture (Stitch canonical):**

| Tab | Icon (Material Symbols) | Route |
|-----|------------------------|-------|
| Insights | `insights` | `/insights` |
| Timeline | `calendar_today` | `/timeline` |
| Profile | `settings` | `/profile` |

**Design tokens:**
- Container: `fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-10 py-5 pb-8 flex justify-between items-center z-50`
- Item: `flex flex-col items-center gap-1.5`
- Icon size: `text-[26px]`
- Label: `text-[9px] font-bold uppercase tracking-tighter`
- Active: `text-energetic-violet` + icon `fill-1` variation setting
- Inactive: `text-slate-400`

**Active tab detection:**
Derive active tab from the router as a computed signal — same pattern as the current implementation, using `toSignal` on `router.events`.

**No FAB.** The Stitch designs do not include a floating action button in the bottom nav. Entry points for logging (behavior incidents, daily reflection) are accessible from the Dashboard/Insights screen.

---

### `BottomSheetComponent`

**Path:** `frontend/src/app/shared/ui/page/bottom-sheet.component.ts`
**Responsibility:** Reusable slide-up overlay for "Add" actions and secondary forms.

An implementation of this component exists with the following canonical style values:

- Top corner radius: `2.5rem`
- Backdrop opacity: `rgba(0,0,0,0.5)` with `backdrop-filter: blur(2px)`
- Close button: top-right position
- Max height: `85vh`

**Usage pattern** — the "Add Medication" example:
```typescript
// In ProfileComponent template:
<app-bottom-sheet [open]="addMedOpen()" title="Add Medication" (closed)="addMedOpen.set(false)">
  <app-add-medication-form (saved)="onMedicationSaved($event)" />
</app-bottom-sheet>
```

Bottom sheet content components (forms) are separate components projected via `ng-content`. The sheet itself has no knowledge of what it contains.

---

## Overlay Stacking and Z-Index

| Layer | Z-index | Component |
|-------|---------|-----------|
| Page content | 0 | Page components |
| Top bar | 30 | `TopBarComponent` |
| Bottom nav | 50 | `ShellBottomNavComponent` |
| Bottom sheet backdrop | 999 | `BottomSheetComponent` |
| Bottom sheet panel | 1000 | `BottomSheetComponent` |

Bottom sheets render above both nav bars. No additional portal or CDK overlay is needed — fixed positioning handles stacking correctly.

---

## Page Content Contracts

Page components rendered inside the shell's `<router-outlet>` must follow these rules:

- **No top/bottom nav** — never render navigation elements inside a page component; those live in the shell
- **Bottom clearance** — pages do not need to manually account for the bottom nav; `ShellComponent`'s `<main>` handles this via `padding-bottom`
- **Scroll container** — `<main>` is the scroll container; page components use `height: auto` and let content flow naturally
- **Full-bleed backgrounds** — if a page section needs a background that spans the full width (e.g. a tinted section card), use negative horizontal margins offset by the container padding, or let the page component own its own horizontal padding rather than relying on `<main>`'s padding

---

## Files Summary

```
frontend/src/app/
├── app.component.ts                       # bare root outlet only
├── app.routes.ts                          # nested shell + feature routes
├── features/                              # screen-level feature components
└── shared/ui/page/
    ├── shell.component.ts                 # shell layout component
    ├── top-bar.component.ts               # sticky header component
    ├── bottom-nav.component.ts            # fixed bottom navigation
    ├── bottom-sheet.component.ts          # reusable slide-up sheet
    └── index.ts                           # page UI exports
```
