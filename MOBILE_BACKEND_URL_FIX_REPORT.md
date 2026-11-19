# ABAS SATHI v5.5.3 — Mobile Backend URL Fix

## Confirmed source issue
The uploaded source bundled an outdated Apps Script deployment URL in `src/utils/authClient.ts` and `src/context/AppContext.tsx`. Login and backend calls use this URL by default. A stale URL saved in browser localStorage could also override the bundled default.

## Changes
- Updated default Apps Script URL to the user-provided deployment URL.
- Added migration handling for prior bundled/legacy URLs so those configurations resolve to the new URL.
- Kept URL selection consistent in both auth client and AppContext.
- Did not change database schema, financial logic, or Apps Script server handlers.

## Important remaining production risks (not fixed by this URL patch)
- Setup notes in this source explicitly say not all forms are converted to server-side writes and server-side authorization for every write is not yet implemented. Do not treat this package as fully production-ready for financial operations until these are completed and tested.
- Live mobile/browser tests and Google Sheets permission checks cannot be performed in this local build environment.
- The central master spreadsheet ID must be configured in Apps Script deployment code.

## Post-deploy client cleanup
On Android Chrome, clear site storage for the deployed website (Chrome Settings > Site settings > Storage > select the site > Clear) or use a fresh Incognito session. This removes a stale URL/session configuration.
