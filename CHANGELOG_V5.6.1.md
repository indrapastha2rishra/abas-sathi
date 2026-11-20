# ABAS SATHI 5.6.1 Change Log

## Login Performance
- Preserved one-request authentication flow.
- Added frontend total login timing.
- Added backend lookup, password-verification and overall authentication timings.

## Backend
- Authentication lookup no longer calls header-repair/write helper.
- Login verifies required columns are present.
- Successful login resolves header indexes once before login metadata updates.

## Security
- 12,000 HMAC-SHA256 password iterations retained.
- Passwords, hashes, session tokens and user identifiers are not logged.
- Existing society/user/account-status checks, rate limit, session issuance and role handling preserved.

## UX / Error handling
- Existing local validation, submission lock, loading state and retry/error handling preserved.

## Version
- Application/package metadata updated to 5.6.1.

## Known limitation
- Existing dashboard bulk-data bootstrap is still present; progressive dashboard refactor is not included in this release patch.
- 3-second performance goal is unverified pending live test.
