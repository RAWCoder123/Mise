# MISE-005IN: pin beta provisioning name/cuisine CHECKs to COLLATE C

Date: 2026-10-06
Branch: `cursor/mise-beta-provisioning-name-cuisine-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Attach durable CHECKs on
`private.beta_restaurant_provisioning_requests`:

- `normalized_restaurant_name`: length 1..120 +
  `collate "C" !~ '[[:cntrl:]]'`
- `normalized_cuisine_type`: null or length <= 120 +
  `collate "C" !~ '[[:cntrl:]]'`

## Why

The invite-only provisioning ledger stored unbound text while the public
`restaurants.name` / `cuisine_type` siblings already have open COLLATE C
cntrl tips (#548/#549). Locale drift under a missing gate could make
dump/restore accept provisioning fingerprint bytes the restored profile
gates would refuse, breaking idempotent replay continuity.

## Scope

- CHECK-only; does **not** rewrite
  `private.service_provision_beta_restaurant`
- Does **not** touch public restaurants name/cuisine tips (#548/#549),
  users tips (#654/#655), or workspace quota logic
- Alone on main OK; timestamp after #655

## Verification

- `npm run typecheck` — passed
- focused `tests/betaProvisioningNameCuisineCntrlLocalePin.test.ts` — 3/3
- `npm test` — 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles timer flake)
- pgTAP plan **14** counted from 14 assertion call sites; Docker unavailable

## Files

- `supabase/migrations/20261006150000_mise_005in_beta_provisioning_name_cuisine_cntrl_locale_pin.sql`
- `supabase/tests/database/beta_provisioning_name_cuisine_cntrl_locale_pin.test.sql`
- `tests/betaProvisioningNameCuisineCntrlLocalePin.test.ts`
- `docs/automation-reports/2026-10-06-beta-provisioning-name-cuisine-cntrl-locale-pin.md`
