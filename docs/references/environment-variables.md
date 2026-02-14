# Environment Variables

This reference documents frontend and backend environment variables used by TrackIt.

## Frontend (`frontend/src/environments/environment.ts`)

- `apiBaseUrl`: API base URL (example: `http://localhost:7071/api`)
- `googleClientId`: Google OAuth client ID

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
- `GOOGLE_CLIENT_ID`
- `TIMELINE_PROJECTION_MODE`
- `TIMELINE_QUERY_ENABLED`

## Notes

- Keep secrets out of committed files.
- Keep variable names consistent between local and deployed environments.
- Update this doc when variables are added, removed, or renamed.
