# Environment Variables

This reference documents frontend and backend environment variables used by TrackIt.

## Frontend (`frontend/src/environments/environment.ts`)

- `apiBaseUrl`: API base URL (example: `http://localhost:7071/api`)
- `clerkPublishableKey`: Clerk publishable key for the browser SDK

## Backend (`api/local.settings.json` for local development)

- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DATABASE`
- `COSMOS_USERS_CONTAINER`
- `COSMOS_PARTICIPANTS_CONTAINER`
- `COSMOS_MEDICATION_LOGS_CONTAINER`
- `COSMOS_EVENT_INDEX_CONTAINER`
- `JWT_SECRET`
- `JWT_AUDIENCE`
- `JWT_EXPIRY_SECONDS`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- `TIMELINE_PROJECTION_MODE`
- `TIMELINE_QUERY_ENABLED`

## Notes

- Keep secrets out of committed files.
- Keep variable names consistent between local and deployed environments.
- `CLERK_JWT_KEY` is optional but useful for networkless session-token verification on the API.
- `CLERK_AUTHORIZED_PARTIES` should be a comma-separated list of allowed browser origins when you want Clerk `azp` validation on the API.
- Update this doc when variables are added, removed, or renamed.
