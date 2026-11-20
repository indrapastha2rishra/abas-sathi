# ABAS SATHI — Version 5.6.2

Previous release: 5.6.1

## Login performance
- Added 5-minute Script Cache for authentication sheet headers (schema only).
- Batched small-span Login_ID candidate reads to reduce Spreadsheet service calls.
- Deferred Last_Login timestamp write to a separate token-validated, non-blocking frontend request.
- Cached safe validated user profile for 30 seconds after successful login to avoid a Central Master profile scan on the first Dashboard API call.
- Dashboard shell mounts immediately after successful authentication; no second profile request is introduced on the login path.

## Security
- Password hash/KDF (12,000 HMAC-SHA256 rounds), account status, Society Code isolation, role checks and session token generation are preserved.
- No plaintext password or hash caching; no bypass, hardcoded credentials, or database schema changes.

## Validation status
- Apps Script syntax: PASS (`node --check`).
- Frontend build/tests: not run; dependencies unavailable in this environment.
- Live integration and performance benchmark: not run.
- Sub-1-second target: not verified; Apps Script cold-start and network/KDF limitations remain.
