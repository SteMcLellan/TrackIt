# Auth Flow (TrackIt)

This document describes how authentication works across the Angular frontend and Azure Functions API.

## Actors and Tokens
- **Clerk session token**: Issued by Clerk for the signed-in browser session. Used only to call `/api/auth/login` or `/api/auth/refresh`.
- **App JWT**: Issued by TrackIt API using HMAC (`HS256`). Used for all authenticated API calls.

## Frontend Flow
1. `main.ts` initializes Clerk at application startup.
2. `LoginComponent` mounts Clerk's hosted sign-in UI when there is no authenticated TrackIt app session.
3. When Clerk reports an active session, `AuthService` requests a Clerk session token from the browser SDK.
4. The frontend exchanges that session token with `POST /api/auth/login` using body `{ "sessionToken": "<clerk_session_token>" }`.
5. The API returns an app JWT plus user profile fields, which are stored in `localStorage` and mirrored in the `AuthService` signal state.
6. Existing `returnUrl` behavior is preserved by keeping Clerk redirects on `/login` until the TrackIt app session is established.

## Frontend Auth State
- `AuthService` keeps a non-null `appUser` signal.
- `isAuthenticated()` is derived from a valid, unexpired `appUser.token`.
- When the TrackIt app token expires but the Clerk session still exists, `AuthService` can exchange the Clerk session again.

## Auth Interceptor Behavior
The `authInterceptor` automatically adds the app JWT to API requests with these rules:
- Only same-origin `/api/*` requests are modified.
- Requests that already include `Authorization` or `x-trackit-app-token` are left unchanged.
- The custom header is `x-trackit-app-token: <app_jwt>`.

## API Flow
### `/api/auth/login` (anonymous)
1. Reads the Clerk session token from one of three sources:
   - Request body: `{ "sessionToken": "<clerk_session_token>" }`
   - Header: `x-trackit-clerk-session-token: <clerk_session_token>`
   - Header: `Authorization: Bearer <clerk_session_token>`
2. Verifies the Clerk session token with Clerk server credentials.
3. Detects when the TrackIt app JWT was sent by mistake and returns a targeted error.
4. Resolves the Clerk user profile, upserts the TrackIt user document, and returns a fresh app JWT.

### `/api/auth/refresh` (anonymous)
1. Reads the Clerk session token from the same request locations.
2. Verifies the Clerk session token and resolves the Clerk user profile.
3. Returns a fresh app JWT for the existing TrackIt user.

### Protected endpoints (require app JWT)
1. Read `x-trackit-app-token`.
2. Call `authorize()` to verify the TrackIt app JWT with the configured HMAC secret and audience.
3. Extract `userId` from the JWT payload for authorization checks.

## Required Environment Variables
### Frontend
- `clerkPublishableKey` in `frontend/src/environments/environment*.ts`

### API
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY` (optional, for networkless verification)
- `CLERK_AUTHORIZED_PARTIES` (optional comma-separated origin allowlist)
- `JWT_SECRET`
- `JWT_AUDIENCE`
- `JWT_EXPIRY_SECONDS`
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DATABASE`
- `COSMOS_USERS_CONTAINER`

## Notes and Gotchas
- `/api/auth/login` and `/api/auth/refresh` require a Clerk session token, not the TrackIt app JWT.
- The TrackIt app JWT is still `HS256`; accidentally sending it to the auth exchange endpoints now yields a Clerk-specific error message.
