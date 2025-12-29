# TrackIt Bootstrap Plan

Plan for an Azure-hosted Angular SPA with a TypeScript Azure Functions API and Cosmos DB, using Google OAuth for sign-in and issuing our own JWT after verification.

## Architecture Overview
- **Front end**: Angular (latest), hosted as static site (Azure Static Web Apps or Storage static website). Avoid Angular Material; Angular CDK allowed.
- **API**: Azure Functions (TypeScript, HTTP triggers) with shared validation utilities.
- **Data tier**: Azure Cosmos DB (serverless or free tier) with a database for user-linked data.
- **Identity**: Google OAuth for sign-in; backend validates Google ID tokens and issues short-lived application JWTs.

## Authentication Flow (Google OAuth ➜ App JWT)
1. **Client sign-in**: Angular app uses Google Identity Services (popup). Request ID token with configured client ID.
2. **Token handoff**: Client sends the Google ID token to an `/auth/login` Function via `Authorization: Bearer <google_id_token>`.
3. **Verification in Azure Functions**:
   - Fetch and cache Google public keys (`https://www.googleapis.com/oauth2/v3/certs`).
   - Verify signature, issuer (`accounts.google.com` or `https://accounts.google.com`), audience (SPA client ID), and expiry.
   - Extract claims: `sub` (Google user ID), `email`, `name`, `picture`.
4. **User provisioning**: Upsert a user document in Cosmos keyed by `sub`, storing profile fields and app-specific settings.
5. **Issue app JWT**:
   - Sign with server-held secret (Function App setting) using HS256.
   - Claims: `sub` (Google `sub`), `role` (e.g., `parent`), `exp` (e.g., 60 minutes), `iat`, and app-level flags (e.g., onboarding status).
   - Return JWT in response body; optionally set an HttpOnly, SameSite=Lax cookie for session continuity.
6. **API protection**: Subsequent calls send `Authorization: Bearer <app_jwt>`. Functions validate signature and expiry using shared middleware. Reject if Google `sub` no longer exists in DB.
7. **Logout/rotation**: Client clears local token and calls `/auth/logout` (optional) to invalidate cookie. Provide a `/auth/refresh` endpoint issuing new JWTs after re-verifying the Google ID token (no refresh tokens stored).

## Data Model (initial)
- **Users container** (`partitionKey: /sub`): `{ sub, email, name, picture, createdAt, lastLoginAt, roles, settings }`
- **Meds container** (`partitionKey: /sub`): medication schedules, adherence logs.
- **Symptoms container** (`partitionKey: /sub`): ADHD symptom entries with severity/timestamp.
- **RUBI Interventions container** (`partitionKey: /sub`): intervention plans and adherence notes.

## Front-end Starting Points
- Angular workspace with feature modules: `auth`, `dashboard`, `entries` (symptoms/meds), `rubi`.
- Route guards using app JWT; interceptor to attach `Authorization` header.
- Reusable CDK-based components for forms and lists; no Angular Material.
- Environment config storing Google Client ID and API base URL.

## Backend Starting Points (Azure Functions)
- Shared `auth` utility for Google ID token validation and app JWT signing.
- HTTP triggers:
  - `auth/login`: validate Google ID token, upsert user, issue app JWT.
  - `auth/refresh`: revalidate Google token and issue new JWT.
  - `me`: return profile and feature flags.
  - CRUD endpoints for meds, symptoms, RUBI interventions (all JWT-protected).
- Bindings for Cosmos DB containers; use serverless/free tier.

## Deployment Notes
- Use Azure Static Web Apps (free) or Storage static website for SPA hosting.
- Azure Functions on Consumption plan (free quota) with Application Settings for secrets (JWT signing key, Google client ID/audience).
- Enable CORS for SPA origin on Functions.
- CI: GitHub Actions workflow to build Angular app and deploy Functions + static site.

## Security Practices
- Store app JWT in memory or HttpOnly cookie; avoid localStorage for long-lived secrets.
- Enforce HTTPS only; set cookie `Secure` in production.
- Limit JWT lifetime; require Google re-auth for refresh.
- Validate CORS and CSRF for cookie-based sessions.

## Next Implementation Steps
1. Scaffold Angular app (no Angular Material) and add Google sign-in button/flow.
2. Scaffold Azure Functions project with `auth/login` endpoint that verifies Google ID tokens and issues app JWTs.
3. Add Cosmos DB database/containers and data access utilities.
4. Implement JWT auth guard/interceptor in Angular and protected API routes in Functions.
5. Set up CI/CD (GitHub Actions) for build/test/deploy to Azure free tiers.
