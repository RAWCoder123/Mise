# Beta owner invitation evidence — 2026-07-28

## Result

Mise staging now has a controlled owner invitation path from trusted
administrator provisioning through protected-link acceptance, bounded password
setup, active owner membership hydration, and subsequent email/password sign-in.

The path preserves the invite-only launch boundary: clients cannot create Auth
users or restaurants, failed acceptance clears partial local sessions, and a
replayed provisioning request cannot create another tenant or invitation.

No production project, public deployment, supplier delivery, billing, Square,
or AI capability was changed.

## Checkpoints

- Invitation domain, application, provisioning, and facade contract: `69a715a`
- Hosted staging callback redirect configuration: `91ef00f`
- Hosted disposable-owner acceptance and replay proof: `dc1d5db`
- Cursor invitation screen and localized mobile QA: `0237f89`

## Hosted staging proof

Target: `ycwozuyyxunnnvalydar` (`Mise Staging Security`)

- Reconciled Auth redirect configuration to allow only the recorded
  `mise://accept-invite` beta callback in addition to existing trusted local
  development destinations.
- Provisioned one unique disposable Auth user and restaurant through the
  service-only operator boundary.
- Created the invitation artifact with exclusive creation and owner-only
  permissions (`0600`) outside the repository.
- Followed the hosted Auth verification redirect without printing or
  persisting callback credentials in test output.
- Accepted one complete invite session, set a bounded password, confirmed the
  active owner membership, signed out, and signed in again with the new
  credentials.
- Replayed the exact provisioning identity and confirmed the same restaurant
  returned without a new invitation or duplicate allocation.
- Confirmed the pre-existing sentinel tenant was unchanged.
- Removed the disposable restaurant, Auth user, invitation artifact, and
  temporary directory.
- `npm run staging:owner-invitation-check`: passed.

## Client and contract safety

- Only the exact `mise://accept-invite` destination and `type=invite` are
  accepted.
- Credentials must form one complete fragment or query pair; mixed, partial,
  rejected, oversized, or wrong-destination callbacks fail closed.
- Passwords must match and contain 12–128 characters.
- Session or password-update failures sign out the partial local session.
- The Expo screen reads one full Linking callback, never parses or logs
  credentials itself, calls only the stable `miseService` facade, clears
  password fields after submission, and routes an active owner to `/today`.
- English, Spanish, and Simplified Chinese expose the same invitation states
  and recovery actions.

## Verification

- `npm run typecheck`: passed
- `npm test`: 329 passed
- `npm run security:backend`: passed
- `npm run design:static`: passed
- `npm run qa:routes`: all routes returned HTTP 200, including
  `/accept-invite`
- `npm run qa:interactions`: passed at 390x844 in English, Spanish, and
  Simplified Chinese; `/accept-invite` had zero horizontal overflow

## Remaining external boundary

The disposable hosted proof validates Auth and tenant behavior, but a physical
iPhone must still accept a release-candidate invitation and hydrate its tenant.
Supabase's default SMTP is not the restaurant delivery channel; Mise must either
configure and monitor custom SMTP or have Raymond deliver the owner-only
protected link through an approved external channel. The link remains a secret
and must never enter source control, logs, analytics, or support screenshots.
