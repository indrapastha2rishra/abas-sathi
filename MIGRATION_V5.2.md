# ABAS SATHI v5.2 — Update & Migration Notes

## Frontend changes
1. Removed the Demo Mode badge, popup, and demo/live mode setting.
2. Society header displays the authenticated `Society_Name`; `Society_Address` is shown immediately below it.
3. Property Master UI and TypeScript model use these canonical fields:
   - `Carpet_Area`
   - `Allocated_Common_Area`
   - `Structural_Area`
   - `Super_Built_up_Area`
4. Ownership History UI joins `OwnerID` to Owner Master and `PropertyID` to Property Master. It displays owner name, flat no., floor, property type and all four area values. `PropertyID` remains an internal relationship key but is not displayed as a table column.
5. Sign out clears the browser session immediately and revokes the server token in a best-effort background request.

## Google Sheets header migration
In each society's `Property Master` sheet, rename only the header cells (do not delete or reorder data columns):

| Previous header | New header |
|---|---|
| `Cover Area` | `Carpet_Area` |
| `Coridoor Area` / `Corridor Area` | `Allocated_Common_Area` |
| `Super Buildup Area` / `Super Builtup Area` | `Structural_Area` |
| `Total Area` | `Super_Built-up_Area` |

The frontend has compatibility mapping for these previous headers on reads. New sheets should use only the canonical names above.

In the Central `Society Master` sheet, add `Society_Address` and populate it for each society. The backend also recognizes `Registered_Address` or `Address` as fallback names.

## Important production limitation
This update addresses the requested UI, mapping, identity display, and sign-out behavior. The existing repository still contains workflows whose writes are held in React/browser state rather than being persisted through fully validated Apps Script endpoints. It also needs a complete server-side permission review and end-to-end testing of financial workflows before it can safely be called production-ready. Do not use it as the sole ledger for live society accounting until those items are completed.
