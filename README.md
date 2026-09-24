# Vider Gmail Login Bridge

Google sign-in and session-based access control for the Vider bridge API.

## Security model

- Users authenticate on Google's sign-in page; this service never asks for a Google password.
- Only Google accounts with a verified email listed in AUTHORIZED_EMAILS can sign in.
- Login sessions are stored in PostgreSQL. The OAuth client secret, session secret, database URL, and allowlist belong in Replit Secrets or an untracked local .env file, never in Git.
- The old shared access code was committed publicly. Treat it as compromised and do not reuse it.
- The core endpoint acknowledges an authenticated prompt but does not call an AI model provider yet.

## Configuration

Use Node.js 18 or newer and a PostgreSQL database. Set these environment variables before starting the server:

| Variable | Purpose |
| --- | --- |
| GOOGLE_CLIENT_ID | OAuth client ID from Google Cloud |
| GOOGLE_CLIENT_SECRET | OAuth client secret from Google Cloud |
| GOOGLE_CALLBACK_URL | Exact backend callback URL, ending in /auth/google/callback |
| SESSION_SECRET | Random secret at least 32 bytes long |
| DATABASE_URL | PostgreSQL connection URL for server-side sessions |
| AUTHORIZED_EMAILS | Comma-separated allowlist of verified Google account emails |
| FRONTEND_ORIGIN | Exact frontend origin, with no path or trailing slash |
| SESSION_COOKIE_SAME_SITE | Optional: lax (default), strict, or none |
| PORT | Optional; defaults to 3000 |
| NODE_ENV | Set to production when deployed |

Create a Google OAuth client of type Web application. Add GOOGLE_CALLBACK_URL exactly as an authorized redirect URI. Keep the client secret private. Configure the frontend origin in FRONTEND_ORIGIN; do not use a wildcard.

For a frontend on a different site from the API, set SESSION_COOKIE_SAME_SITE=none and serve both over HTTPS. The browser must send credentials on API requests. For a same-site deployment, the default lax setting is preferred.

A placeholder configuration is in .env.example. Copy it to .env only for local development; .env is ignored by Git. In Replit, add actual values through Secrets instead of committing them.

## Run locally

1. Install dependencies with npm install.
2. Set the required variables above.
3. Start the API with npm start.
4. Open /auth/google in a browser to sign in.

## Routes

- GET /auth/google — start Google OAuth.
- GET /auth/google/callback — OAuth callback; register this exact URL with Google.
- GET /api/vider/auth — return the current allowlisted session (requires sign-in).
- POST /api/vider/core — accept an authenticated prompt; requires the exact FRONTEND_ORIGIN and a JSON body with a non-empty prompt of at most 8,000 characters.
- POST /api/vider/logout — end the signed-in session; requires the exact FRONTEND_ORIGIN.
- GET /healthz — basic health check.
- POST /api/vider/auth — returns 410 Gone; the old email/access-code login is removed.

Start sign-in by navigating the browser to the API's /auth/google route. For cross-origin browser calls, use fetch with credentials: 'include'. The core endpoint does not return or log the submitted prompt and does not yet connect to an AI provider.
