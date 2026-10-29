# MISE-005TW Home / Ask Mise greeting firstName ASCII C

Date: 2026-10-29

## Inventing proof

Prior Home `firstName(user?.name)` and Ask Mise welcome
`user?.name?.trim().split(/\s+/)[0]` Unicode-trimmed the signed-in display
name before taking the first whitespace token for on-screen greeting copy:

```text
('\u2003' + 'Alex Rivera' + '\u2003').trim().split(/\s+/)[0]
  === 'Alex'
→ rendered into `Good morning, Alex.` / `Hi Alex, I’m Mise.`

('\u00a0' + 'Alex Rivera' + '\u00a0').trim().split(/\s+/)[0]
  === 'Alex'
→ same inventing via NBSP padding
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional i18n fallback names (`home.greeting.fallbackName` /
`ask.greeting.fallbackName`).

Not owned by open #960 (outreach fallback draft greeting `firstName`),
#849 (user profile display name persistence), Create Task assignee chip
labels, More profile name / initials, or team member directory labels.
Open #960 explicitly left Home / Ask Mise presentation greets alone.

## Fix

New `services/domain/presentationGreetingFirstNameIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  the value is non-string
- preserves soft-empty / fail-closed tokens as null so the live
  `|| t("….fallbackName")` / `?? ""` + fallback branches own the intentional
  localized greeting fallback without inventing a clean first-name token
  from padding

Wired into:

- `app/(tabs)/home.tsx` local `firstName` helper
- `app/ask-mise.tsx` welcome greeting seed

Left outreach draft greeting (#960), user profile display name (#849),
Create Task assignee labels, More initials / profile name, and team
directory labels alone.

Do **not** share this module with:

- #960 / MISE-005TV `outreachGreetingFirstNameIdentity`
- #849 / MISE-005PO user profile display name
- Create Task assignee chip label presentation
- More / team directory presentation name splits

## Verification

- focused AsciiC tests
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
