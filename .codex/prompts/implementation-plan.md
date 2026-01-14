# Implementation Plan Guide

Use this guide for implementation plans in `docs/feature/<feature-name>.impl.md`.

## Purpose
Implementation plans translate product specs into technical work: data models, APIs, UI changes, migrations, and testing.

## Required Sections
1. **Scope Recap** (pull from feature spec)
2. **Assumptions / Open Questions** (technical decisions still needed)
3. **Technical Plan**
   - Data model changes
   - API shape and endpoints
   - Frontend/UI changes
   - Validation + auth
   - Testing approach
4. **Sequencing** (ordered steps)
5. **Story-Tracking Checklist** (tasks mapped to each user story)

## Conventions
- Use the exact file name pattern: `docs/feature/<feature-name>.impl.md`.
- Define data models using TypeScript type aliases.
- For each stored object, include the Cosmos container name and partition key.
- Include concrete data types, API shapes, and validation rules.
- Call out auth and authorization requirements explicitly.
- Keep the plan actionable and step-by-step.
- Map tasks back to user stories so progress is trackable by story.

## UI/UX Implementation Notes
- Before creating new UI, check for existing components and reuse them to keep a consistent look and feel.
- Follow existing visual patterns (spacing, typography, interaction states).
- Prefer design tokens / CSS custom properties for colors, spacing, and sizing to support theming later.

## API Contract Template
Use this compact format per endpoint:

```
### METHOD /path
Auth: <auth requirement>
Request: <TypeScript type name or inline shape>
Response: <TypeScript type name or inline shape>
Errors: <status codes + brief conditions>

Example request:
{ ... }

Example response:
{ ... }
```

## API Conventions (Collections, Search, Paging)
- Collection endpoints return a consistent envelope:
  ```json
  {
    "items": [ /* resource array */ ],
    "nextToken": "opaque-string-or-null"
  }
  ```
- Use a shared TypeScript type for collection envelopes:
  ```ts
  export type CollectionResponse<T> = {
    items: T[];
    nextToken: string | null;
  };
  ```
- Use cursor-based paging via `nextToken` (avoid offset paging in Cosmos).
- Standard query params:
  - `pageSize` (integer, default 25, max 100)
  - `nextToken` (string, optional)
  - `sort` (e.g., `createdAt:desc`), only when meaningful
  - `filter` for structured filters (simple field=value pairs)
- When `nextToken` is omitted or null, return the first page.
- Omit `nextToken` or set to null when there are no more results.

## Error Response Conventions
- Always return the most relevant HTTP status code.
- Use RFC 9457 Problem Details (`application/problem+json`) with an `errors` extension array:

```json
{
  "type": "https://example.net/validation-error",
  "title": "Your request is not valid.",
  "status": 400,
  "errors": [
    {
      "id": "auth.unauthorized",
      "message": "Missing or invalid access token."
    }
  ]
}
```

Guidelines:
- `id` is a stable, globally unique identifier (dot-separated namespace).
- `message` is human-readable and safe to surface to users when appropriate.

## Relationship to Feature Specs
- Feature specs remain product-first and user-focused.
- Implementation plans can include technical details and constraints.
- Always read the feature spec before drafting the implementation plan.
