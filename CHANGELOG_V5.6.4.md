# Changelog — ABAS SATHI v5.6.4

- Returning-user local session restore no longer blocks on server verification.
- Session verification runs in background; app shell renders immediately from saved session.
- Confirmed invalid/expired server session clears local session and returns to Login.
- Transient connection failures keep local session for restricted shell and show retry/sign-out status.
- Online/offline browser events update status and retry verification on reconnect.
- Added 4 static regression tests for session restore and background validation behavior.
- No Sheets schema, financial calculations, roles, or module feature changes.
