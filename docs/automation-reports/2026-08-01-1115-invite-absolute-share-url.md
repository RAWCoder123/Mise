# Invite absolute share URL (2026-08-01)

## Completed

- Added `buildInviteClaimUrl` that wraps the relative claim path through Expo `Linking.createURL`.
- Team Settings copies and displays an absolute invite handoff URL (`mise://…` / env-correct scheme).
- In-app claim navigation still uses `/invite/[token]`.
- Locale copy updated from “path” to “link” (en / es / zh-Hans).

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
