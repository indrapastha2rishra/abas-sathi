# v5.6.3

- Added validated 5-minute row-index cache for Society Code and Login ID to reduce repeated login lookup scans.
- Cached row numbers only; actual sheet rows are reread and checked each login, stale cache falls back to TextFinder.
- Preserved password verification, session, society isolation, and roles.
- Existing regression suite plus cache validation static test: 13/13 CJS tests passed.
- Not production-certified; build/lint/live backend testing remain pending.
