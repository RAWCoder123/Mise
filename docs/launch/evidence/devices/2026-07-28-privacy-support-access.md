# Privacy and support access evidence

Date: 2026-07-28  
Batch: `private-beta-privacy-support-24`

## Scope verified

- Privacy and support disclosures are reachable before sign-in from `/login`.
- Signed-in users can reach the same routes from Settings.
- Privacy, support, export, deletion, provider, and draft-only ordering copy
  matches the August 3 restaurant-beta scope.
- The login links remain independently accessible; their parent does not
  collapse them into one text element.
- Support mail actions contain only a fixed public recipient and fixed subject.
- The policy action targets only `https://getmise.app/privacy`.
- The app states that public hosting and inbox monitoring remain pending.

## Checkpoints

- Cursor route and localization implementation: `42d92d6`
- Cursor bounded contact and policy actions: `c286102`
- Cursor signed-out access: `599827c`
- Cursor accessibility correction: `77642e1`
- Codex source privacy/support policy: `b172ab1`
- Codex static access and destination tests: `96403ac`

## Verification

- `git diff --check`: passed
- `npm run typecheck`: passed
- `npm test`: 313 passed
- `npm run design:static`: passed
- `npm run qa:routes`: passed; `/settings/privacy` and `/settings/support`
  returned HTTP 200
- `npm run qa:interactions`: passed at 390x844 in English, Spanish, and
  Simplified Chinese; every rendered route reported zero horizontal overflow

## External release evidence still required

- Publish the reviewed policy source at `https://getmise.app/privacy`.
- Confirm `support@getmise.app` and `privacy@getmise.app` are actively monitored
  by named beta responders.
- On the exact TestFlight candidate, verify VoiceOver focus, back navigation,
  Mail handoff, browser handoff, and safe fallback behavior on physical iPhones.

No public host, inbox, production environment, TestFlight build, or branch
push was changed while recording this evidence.
