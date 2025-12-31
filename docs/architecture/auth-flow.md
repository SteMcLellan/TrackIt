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
   - Header: `Authorization: Bearer <google_id_token>`
5. The API returns an **app JWT**, which is stored in `localStorage` and held in a signal (`AuthService`).

## Frontend Auth State
- `AuthService` keeps a non-null `appUser` signal.
- `isAuthenticated()` is derived from a valid, unexpired `appUser.token`.
- `authInterceptor` adds the app JWT to outgoing requests **only** when `isAuthenticated()` is true.

## API Flow
### `/api/auth/login` (anonymous)
1. Reads `Authorization: Bearer <google_id_token>`.
2. Verifies the Google ID token using Google JWKS.
3. Upserts the user in Cosmos DB.
4. Signs and returns an **app JWT**.

### `/api/auth/refresh` (anonymous)
1. Reads `Authorization: Bearer <google_id_token>`.
2. Verifies the Google ID token.
3. Returns a fresh **app JWT**.

### `/api/me` (anonymous endpoint that validates app JWT)
1. Reads `Authorization: Bearer <app_jwt>`.
2. Verifies the app JWT using the configured HMAC secret + audience.
3. Returns the JWT payload.

## Required Environment Variables (API)
- `GOOGLE_CLIENT_ID`
- `JWT_SECRET`
- `JWT_AUDIENCE` (default: `trackit-app`)
- `JWT_EXPIRY_SECONDS` (default: `3600`)
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DATABASE` (default: `trackit`)
- `COSMOS_USERS_CONTAINER` (default: `users`)

## Notes and Gotchas
- `/api/auth/login` and `/api/auth/refresh` **require a Google ID token**, not the app JWT.
- The app JWT is **HS256**, while Google ID tokens are **RS256**. Mixing them will fail verification.
