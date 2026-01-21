# CLAUDE.md - AI Development Guide for TrackIt

**Quick Reference:** This doc covers unique patterns specific to TrackIt. For deeper dives, see `docs/architecture/`.

## Tech Stack Summary

- **Frontend:** Angular 21 (standalone components, signals, zoneless)
- **Backend:** Azure Functions (Node.js, TypeScript)
- **Database:** Azure Cosmos DB (NoSQL)
- **Auth:** Google OAuth → JWT (HMAC signed)

## Critical Patterns Unique to This Codebase

### 1. Signal-Based State (Not RxJS)

Use Angular Signals for simple state management, NOT RxJS Subjects/BehaviorSubjects.

```typescript
// ✅ Correct
private readonly state = signal(initialValue);
readonly state = this.state.asReadonly();

// ❌ Wrong
private state$ = new BehaviorSubject(initialValue);
```

Use RxJS only for HTTP operations. Components use signals in templates: `@if (signal()) { }`.

### 2. UTC + Local Time Storage

**Critical:** Store all timestamps as UTC + separate local context. Never store local times without timezone info.

```typescript
// ✅ Correct
{
  createdAtUtc: "2026-01-20T12:00:00Z",  // UTC ISO 8601
  logLocalDate: "2026-01-20",             // User's local date (YYYY-MM-DD)
  logLocalTime: "07:00",                  // User's local time (HH:mm)
  logTzOffsetMinutes: 300                 // Offset from UTC
}

// ❌ Wrong
{
  timestamp: "2026-01-20T07:00:00"  // Missing timezone context!
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

**Partition Keys:** Match query patterns (e.g., `/userId` for user queries)

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

Always use `withErrorHandling` wrapper - it catches errors automatically:

```typescript
import { withErrorHandling } from '../shared/errors';

export const handler = withErrorHandling(async (req, context) => {
  // Throw errors directly; wrapper catches and returns 500
  if (!data) throw new Error('Not found');

  // Or return explicit responses
  return { status: 200, jsonBody: { success: true } };
});
```

### 6. Authorization Pattern

All protected endpoints use `authorize()`:

```typescript
import { authorize } from '../shared/authorize';

export const handler = withErrorHandling(async (req, context) => {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;

  const { userId } = auth.value; // Use for queries
});
```

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

## File & Naming Conventions

**Files:** kebab-case (e.g., `behavior-incident.component.ts`)
**Classes/Types:** PascalCase (e.g., `BehaviorIncident`)
**Functions/Variables:** camelCase (e.g., `createIncident`)
**Constants:** UPPERCASE_SNAKE_CASE (e.g., `API_BASE_URL`)

**TypeScript suffixes:**
- Backend documents: `*Document` (e.g., `ParticipantDocument`)
- Frontend models: No suffix (e.g., `Participant`)
- Request/Response: `*Request`, `*Response`

## Key Architecture Decisions

1. **Standalone Components** - No NgModules; each component declares own imports
2. **Zoneless Change Detection** - All components use `ChangeDetectionStrategy.OnPush`
3. **Minimal Dependencies** - Intentional; reduces attack surface and bundle size
4. **JWT-Based API Auth** - Stateless; token in `x-trackit-app-token` header
5. **Monorepo** - Single npm workspace for coordinated deployment

## Things to Avoid

❌ Don't use NgModules (standalone components only)
❌ Don't use RxJS for simple state (use Signals)
❌ Don't store local timestamps without timezone context
❌ Don't hardcode URLs (use `environment.apiBaseUrl`)
❌ Don't skip error handling on HTTP calls
❌ Don't forget `authorize()` in API functions
❌ Don't use default change detection (always OnPush)
❌ Don't create separate .html/.css files (inline templates/styles)

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

## Environment Variables

**Frontend** (`environment.ts`):
- `apiBaseUrl` - API endpoint (e.g., `http://localhost:7071/api`)
- `googleClientId` - Google OAuth client ID

**Backend** (`local.settings.json`):
- `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE_NAME`
- `JWT_SECRET_KEY` - Secret for signing JWTs
- `GOOGLE_CLIENT_ID` - For OAuth validation

## Architecture Documentation

For detailed information on specific areas:

- **`docs/architecture/auth-flow.md`** - Authentication flow, JWT handling
- **`docs/architecture/data-modeling.md`** - Cosmos schema, UTC+local time, compound IDs
- **`docs/architecture/participant-association.md`** - Active participant pattern
- **`docs/architecture/behavior-tracking-abc.md`** - ABC behavior tracking model

---

**Keep this file focused on unique patterns. Add detailed explanations to `docs/architecture/` files.**
