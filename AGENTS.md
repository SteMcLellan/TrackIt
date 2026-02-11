# CLAUDE.md - AI Development Guide for TrackIt

**Quick Reference:** This doc covers unique patterns specific to TrackIt. For deeper dives, see `docs/architecture/`.

## Tech Stack Summary

- **Frontend:** Angular 21 (standalone components, signals, zoneless)
- **Backend:** Azure Functions (Node.js, TypeScript)
- **Database:** Azure Cosmos DB (NoSQL)
- **Auth:** Google OAuth -> JWT (HMAC signed)

## UI/UX Design Principles

**Philosophy:** Modern, mobile-first web application prioritizing quick information access and low-friction data entry.

### Core Principles

1. **Mobile-First Design** - Design for small screens first, then scale up for larger viewports
2. **Quick Access** - Surface important information immediately; minimize taps/clicks to reach key data
3. **Low-Friction Recording** - Streamline entry of events, medications, and incidents; prefer single-tap actions where possible
4. **Thumb-Friendly** - Place primary actions within easy thumb reach on mobile

### Interaction Patterns

- **Bottom sheet for "Add" actions** — when a list item needs an "Add" entry point (e.g. medications, incidents), use a bottom sheet (slides up ~65–75% of screen height with rounded top corners and a dimmed overlay) rather than inline expansion, a dialog, or a full-screen push. Reserve full-screen push for complex multi-step flows.
- **Edit-mode-only Save buttons** — forms on settings/profile screens should show read-only display values at rest. Surface input fields and the Save button only when the user taps an Edit affordance. Never show a Save button when no changes have been made.
- **Semantic color per section** — section cards on management screens (profile, forms) use tinted backgrounds mapped to the app's semantic palette. See `DESIGN.md` for the color-to-role mapping (emerald = wellness/medications, violet = behavioral/people, amber = alerts/scheduling, azure = context/environment).

### Mobile Layout Rules

- **No horizontal scrolling** - Content must fit within viewport width at all screen sizes
- **Nothing off-screen** - All interactive elements must be fully visible and accessible
- **Use `max-width: 100%`** - Prevent elements from overflowing their containers
- **Responsive text** - Avoid fixed pixel widths that break on small screens
- **Touch targets** - Minimum 44x44px for tappable elements

```css
/* Correct - Responsive container */
.container {
  width: 100%;
  max-width: 600px;
  padding: var(--space-4);
}

/* Wrong - Fixed width breaks mobile */
.container {
  width: 600px;
}
```

### Testing UI Changes

**Target Device:** iPhone 14 and later models (390px viewport width)

Always verify UI changes at mobile viewport sizes (375px width minimum). Check for:
- Horizontal overflow causing scrollbars
- Elements clipped or hidden off-screen
- Text wrapping correctly
- Touch targets adequately sized

## Stitch Migration Workflow

Use Stitch as the canonical design source while migrating the existing UI incrementally.

- **TrackIt Stitch project:** `projects/2002730124455423542`
- Default to this project for TrackIt UI migration work unless the user explicitly specifies another project.
- Not all TrackIt flows are in Stitch yet; convert existing components as corresponding Stitch screens become available.
- **Design system:** `DESIGN.md` is the canonical reference for colors, typography, component styles, and the canonical page shell (top app bar + bottom nav). Consult it before implementing any UI component.

### Known Stitch Behaviors

- **Target one screen at a time with `edit_screens`** — passing multiple screen IDs can silently no-op with no error. If an edit doesn't produce a new screen, retry with a single screen ID.
- **Screen title drift** — Stitch generates titles from prompt phrasing and often gets them wrong (e.g. "Profile Dashboard" instead of "Profile"). Titles are cosmetic and don't affect implementation; don't waste a generation on renaming.
- **Use the `enhance-prompt` skill** before submitting complex or color-specific edits — it injects DESIGN.md tokens and structures prompts for better results.

### Required Stitch Metadata for Converted Components

When a component is implemented from a Stitch screen, add a metadata comment block immediately above `@Component(...)`:

```typescript
/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/<screen-id>
 * @stitch-screen-title <screen title>
 * @stitch-status converted
 * @stitch-last-sync YYYY-MM-DD
 */
```

Rules:
- The metadata block is required for any component marked as Stitch-converted.
- `@stitch-screen` must use the full Stitch resource name.
- `@stitch-last-sync` is the date the component last synced to a Stitch design (`YYYY-MM-DD`).

### Stitch Migration Progress Tracking

- Source-of-truth tracker: `docs/architecture/stitch-migration.md`
- Track all frontend Angular components (`frontend/src/app/**/*.component.ts`).
- Keep tracker status binary: `Converted` or `Not`.
- Update the tracker in the same PR that migrates a component.
- Run `npm run audit:stitch-migration` before finishing Stitch migration changes.

## Critical Patterns Unique to This Codebase

### 1. Signal-Based State (Not RxJS)

Use Angular Signals for simple state management, NOT RxJS Subjects/BehaviorSubjects.

```typescript
// Correct
private readonly state = signal(initialValue);
readonly state = this.state.asReadonly();

// Wrong
private state$ = new BehaviorSubject(initialValue);
```

Use RxJS only for HTTP operations. Components use signals in templates: `@if (signal()) { }`.

### 2. UTC + Local Time Storage

**Critical:** Store all timestamps as UTC + separate local context. Never store local times without timezone info.

```typescript
// Correct
{
  createdAtUtc: "2026-01-20T12:00:00Z",  // UTC ISO 8601
  logLocalDate: "2026-01-20",             // User's local date (YYYY-MM-DD)
  logLocalTime: "07:00",                  // User's local time (HH:mm)
  logTzOffsetMinutes: 300                  // Offset from UTC
}

// Wrong
{
  timestamp: "2026-01-20T07:00:00"  // Missing timezone context
}
```

**See:** `docs/architecture/data-modeling.md` for full details.

### 3. Cosmos DB Patterns

**Compound IDs:** Use prefixes and colons for relationships
```typescript
// Document IDs
`participant_${uuid}`
`user_${uuid}`

// Relationship IDs
`${userId}:${participantId}`
```

**Partition Keys:** Match query patterns (for example `/userId` for user queries and `/participantId` for timeline/event reads)

**See:** `docs/architecture/data-modeling.md` for schema details.

### 4. Inline Templates & Styles

Keep component templates and styles inline (not separate files). Improves locality.

```typescript
@Component({
  selector: 'app-example',
  template: `<div>Content here</div>`,
  styles: [`
    .container { padding: var(--space-4); }
  `]
})
```

### 5. API Error Handling Wrapper

Always use `withErrorHandling` wrapper:

```typescript
import { withErrorHandling } from '../shared/auth';

export const handler = withErrorHandling(async (req, context) => {
  if (!data) throw new Error('Not found');
  return { status: 200, jsonBody: { success: true } };
});
```

### 6. Authorization Pattern

All protected endpoints use `authorize()`:

```typescript
import { authorize } from '../shared/authorize';

export const handler = withErrorHandling(async (req, context) => {
  const user = authorize(context, req); // throws 401 on missing/invalid token
  const { sub } = user;
});
```

For admin-only routes, use `requireAdmin()` from `api/src/shared/admin.ts`.

**See:** `docs/architecture/auth-flow.md` for full flow.

### 7. Result Type Pattern

Use explicit success/failure types (no exceptions for expected failures):

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; response: HttpResponseInit };
```

### 8. Active Participant Context

Most features require an active participant selected:
- Use `ActiveParticipantGuard` on routes
- Service exposes `activeParticipantId` signal
- Components read: `readonly participantId = this.service.activeParticipantId;`

**See:** `docs/architecture/participant-association.md`

### 9. Timeline EventIndex Pattern

- Keep domain containers as source-of-truth.
- Use `eventIndex` as an append-only projection for cross-domain timeline queries.
- Projection records must include a pointer back to source (`sourceType`, `sourceId`, `sourceContainer`, `sourcePartitionKey`) and deterministic IDs for idempotency.
- Backfill and verify must go through admin-protected internal routes:
  - `/api/internal/admin/migrations/event-index/backfill`
  - `/api/internal/admin/migrations/event-index/verify`

## File & Naming Conventions

**Files:** kebab-case (for example `behavior-incident.component.ts`)
**Classes/Types:** PascalCase (for example `BehaviorIncident`)
**Functions/Variables:** camelCase (for example `createIncident`)
**Constants:** UPPERCASE_SNAKE_CASE (for example `API_BASE_URL`)

**TypeScript suffixes:**
- Backend documents: `*Document` (for example `ParticipantDocument`)
- Frontend models: No suffix (for example `Participant`)
- Request/Response: `*Request`, `*Response`

## Key Architecture Decisions

1. **Standalone Components** - No NgModules; each component declares own imports
2. **Zoneless Change Detection** - All components use `ChangeDetectionStrategy.OnPush`
3. **Minimal Dependencies** - Intentional; reduces attack surface and bundle size
4. **JWT-Based API Auth** - Stateless; token in `x-trackit-app-token` header
5. **Monorepo** - Single npm workspace for coordinated deployment

## Things to Avoid

- Do not use NgModules (standalone components only)
- Do not use RxJS for simple state (use Signals)
- Do not store local timestamps without timezone context
- Do not hardcode URLs (use `environment.apiBaseUrl`)
- Do not skip error handling on HTTP calls
- Do not forget `authorize()` in API functions
- Do not use default change detection (always OnPush)
- Do not create separate `.html`/`.css` files (inline templates/styles)
- Do not use fixed pixel widths that break mobile layouts
- Do not create UI that causes horizontal scrolling on mobile
- Do not make touch targets smaller than 44x44px
- Do not skip mobile viewport testing for UI changes
- Do not use custom Azure Function routes under `/admin/*` (reserved by host)
- Do not commit `frontend/src/proxy.conf.json`

## Common Tasks

### Add New API Endpoint

1. Create `api/src/functions/{resource}-{action}.ts`
2. Use `withErrorHandling` wrapper
3. Add `authorize()` check if protected
4. Register with `app.http()` with route

### Add New Component

1. Create inline component in `frontend/src/app/features/{feature}/`
2. Add to parent's `imports` array or route definition
3. Use `ChangeDetectionStrategy.OnPush`
4. Inject services via `inject()`

### Add New Model

1. Backend: Create `*Document` interface in `api/src/models/`
2. Frontend: Create interface (no suffix) in `frontend/src/app/shared/models/`
3. Include UTC timestamps + local context fields

## Git Commit Format

```
<type>(<scope>): <subject>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `chore`
**Examples:**
- `feat(incidents): add ABC behavior tracking`
- `fix(auth): resolve Google button race condition`
- `docs(architecture): update data modeling guide`

## Development Commands

```bash
npm run dev:all        # Start frontend + API
npm run lint           # Check code quality
npm run format         # Apply Prettier
npm run build          # Production build
```

### Verifying Frontend Builds

The user may have `npm run dev:frontend:log` running in the background. This runs the Angular dev server and writes build output to `dist/frontend/dev-frontend.log`.

To check for compilation errors, read this log file instead of running a full build:
```bash
cat dist/frontend/dev-frontend.log
```

Look for "Application bundle generation complete" to confirm success, or TypeScript errors if the build failed.

## Environment Variables

**Frontend** (`environment.ts`):
- `apiBaseUrl` - API endpoint (for example `http://localhost:7071/api`)
- `googleClientId` - Google OAuth client ID

**Backend** (`local.settings.json`):
- `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE`
- `COSMOS_USERS_CONTAINER`, `COSMOS_PARTICIPANTS_CONTAINER`, `COSMOS_MEDICATION_LOGS_CONTAINER`, `COSMOS_EVENT_INDEX_CONTAINER`
- `JWT_SECRET`, `JWT_AUDIENCE`, `JWT_EXPIRY_SECONDS`
- `GOOGLE_CLIENT_ID`
- `TIMELINE_PROJECTION_MODE`, `TIMELINE_QUERY_ENABLED`

## Architecture Documentation

For detailed information on specific areas:

- **`DESIGN.md`** - Canonical design system: color palette, typography, component styles, canonical page shell
- **`docs/architecture/page-shell.md`** - Page shell architecture: routing structure, ShellComponent, TopBarComponent, BottomNavComponent, BottomSheetComponent
- **`docs/architecture/auth-flow.md`** - Authentication flow, JWT handling
- **`docs/architecture/data-modeling.md`** - Cosmos schema, UTC/local time, eventIndex semantics
- **`docs/architecture/participant-association.md`** - Active participant pattern
- **`docs/architecture/behavior-tracking-abc.md`** - ABC behavior tracking model
- **`docs/architecture/stitch-migration.md`** - Stitch conversion inventory and migration progress

---

**Keep this file focused on unique patterns. Add detailed explanations to `docs/architecture/` files.**
