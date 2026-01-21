# Auth Flow (TrackIt)

This document describes how authentication works across the Angular frontend and Azure Functions API.

## Actors and Tokens
- **Google ID Token**: Issued by Google Identity Services. Used only to call `/api/auth/login` or `/api/auth/refresh`.
- **App JWT**: Issued by TrackIt API using HMAC (`HS256`). Used for all authenticated API calls.

## Frontend Flow
1. **Login view renders** (`LoginComponent`).
2. If the user is already authenticated, redirect to `/dashboard` and do not render the Google button.
3. Google Identity Services renders the sign-in button.
4. On successful Google sign-in, the frontend calls:
   - `POST /api/auth/login`
   - Body: `{ "idToken": "<google_id_token>" }`
5. The API returns an **app JWT**, which is stored in `localStorage` and held in a signal (`AuthService`).

## Frontend Auth State
- `AuthService` keeps a non-null `appUser` signal.
- `isAuthenticated()` is derived from a valid, unexpired `appUser.token`.
- `authInterceptor` adds the app JWT to outgoing requests **only** when `isAuthenticated()` is true.

## Auth Interceptor Behavior
The `authInterceptor` automatically adds the app JWT to API requests with these rules:
- **Only same-origin `/api/*` requests** - External requests are not modified
- **Skips requests with existing auth** - If `Authorization` or `x-trackit-app-token` headers are already present, they are not modified
- **Only when authenticated** - Token is only added if `isAuthenticated()` returns true
- **Custom header** - Sets `x-trackit-app-token: <app_jwt>` (not Authorization header)

## API Flow
### `/api/auth/login` (anonymous)
1. Reads Google ID token from one of three sources (in priority order):
   - **Request body** (primary): `{ "idToken": "<google_id_token>" }`
   - Header: `x-trackit-google-id-token: <google_id_token>`
   - Header: `Authorization: Bearer <google_id_token>` (fallback)
2. Verifies the Google ID token using Google JWKS.
3. Detects if an HMAC token (HS256) was sent instead of Google's RS256 token and returns a helpful error.
4. Upserts the user in Cosmos DB.
5. Signs and returns an **app JWT** in the response body.

### `/api/auth/refresh` (anonymous)
1. Reads Google ID token (same three sources as login).
2. Verifies the Google ID token.
3. Returns a fresh **app JWT**.

### Protected endpoints (require app JWT)
1. Read `x-trackit-app-token` header.
2. Call `authorize()` to verify the app JWT using the configured HMAC secret + audience.
3. Extract `userId` from the JWT payload for authorization checks.

## Required Environment Variables (API)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID for verifying Google ID tokens
- `JWT_SECRET` - HMAC secret for signing app JWTs (default: `local-secret`)
- `JWT_AUDIENCE` - Audience claim for app JWTs (default: `trackit-app`)
- `JWT_EXPIRY_SECONDS` - Token expiry time in seconds (default: `3600`)
- `COSMOS_ENDPOINT` - Azure Cosmos DB endpoint URL
- `COSMOS_KEY` - Azure Cosmos DB access key
- `COSMOS_DATABASE` - Database name (default: `trackit`)
- `COSMOS_USERS_CONTAINER` - Users container name (default: `users`)

## Notes and Gotchas
- `/api/auth/login` and `/api/auth/refresh` **require a Google ID token**, not the app JWT.
- The app JWT is **HS256**, while Google ID tokens are **RS256**. Mixing them will fail verification.
