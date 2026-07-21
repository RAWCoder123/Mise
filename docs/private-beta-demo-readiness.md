# Mise Private-Beta Demo Readiness

Use this before handing Mise to a restaurant owner, advisor, or private-beta tester.

## Goal

The tester should be able to open Mise, enter the replaceable local demo dataset, understand the value within 60 seconds, and safely test the main workflows without live POS, real Gmail delivery, supplier APIs, OpenAI, or production restaurant data.

## Demo Data Walkthrough

1. Open Mise.
2. On Login, choose **Open Demo Data**.
3. Confirm Today identifies the configured sample restaurant.
4. Review the command center:
   - stock risk,
   - suggested order work,
   - sales movement,
   - recipe/POS coverage,
   - next best action.
5. Open Inventory and update one count.
6. Open an inventory detail route.
7. Open Orders.
8. Approve one recommendation.
9. Dismiss one recommendation.
10. Use Undo from the confirmation toast.
11. Open a supplier draft.
12. Copy the supplier order.
13. Connect the explicitly simulated demo Gmail sender, simulate sending an approved draft, confirm that no email was sent, and verify the order appears in sent/history state.
14. Open Insights and confirm claims are based on available data.
15. Open Settings.
16. Review POS readiness and confirm it is demo-only.
17. Review Recipe readiness.
18. Select Spanish and Simplified Chinese/Mandarin, reload after each choice to verify persistence and layout, then restore English.
19. Restore demo data and confirm the configured sample dataset returns to its original state.
20. Open Setup and confirm the guided setup path still explains profile, inventory, recipes, suppliers, email, and import readiness.

## Safety Expectations

- The bundled demo dataset is local-only sample data.
- Its identity and fixture rows can be replaced in `services/demo/` without changing screens, service contracts, or Supabase repositories.
- Demo reset must never touch hosted Supabase tenant data.
- Demo supplier sending is an explicit local simulation and must always state that no email was sent.
- Real Gmail sending stays default-off even though the backend OAuth/delivery path is implemented; it requires approved Google credentials, consent configuration, a designated test account, and an approved recipient.
- Live POS sync is disabled until backend-only provider credentials are implemented.
- OpenAI calls are disabled until server-side API keys and structured workflows are enabled.
- Expo public env vars must remain limited to public Supabase URL/anon key and public app flags.

## Local Verification Commands

Run:

```bash
npm run verify:beta
npm run qa:interactions
```

`verify:beta` covers typecheck, unit tests, high-level audit, Expo Doctor, static security checks, static design checks, web export, route smoke, mobile layout, and the complete demo-data interaction proof.

`qa:interactions` is the canonical rendered demo proof. It includes the complete mobile-width route sweep before testing inventory, Orders, simulated Gmail connect/delivery, supplier recovery, Spanish and Chinese persistence, recipes, Insights, POS demo state, reset, sign-out, and guided setup persistence.

## Hosted Supabase Staging Flow

1. Create or open the hosted Supabase staging project.
2. Apply `supabase/migrations/*.sql` in order.
3. Confirm public tables used by `supabase-js` have explicit `authenticated` grants plus RLS policies.
4. Load the trusted staging values locally or from a protected CI context:

```bash
SUPABASE_STAGING_URL=...
SUPABASE_STAGING_PROJECT_REF=...
SUPABASE_STAGING_ANON_KEY=...
SUPABASE_STAGING_SECRET_KEY=...
MISE_STAGING_MARKER=...
MISE_STAGING_SEED_PASSWORD=...
```

5. Run the complete hosted proof. The trusted Node bootstrap uses the server-only secret for Auth Admin user creation; Expo never receives it.

```bash
npm run verify:private-beta-security:hosted
```

6. Confirm:
   - two restaurants exist,
   - two owners exist,
   - one manager exists,
   - one staff account exists,
   - cross-restaurant reads fail,
   - cross-restaurant writes fail,
   - staff cannot manage restricted data,
   - manager can operate inventory/order workflows,
   - audit rows use database-controlled actor identity,
   - rendered tenant races pass for Today, Inventory, Orders, Insights, Settings, and both detail screens,
   - Edge concurrency accepts exactly 8 of 20 clean-window POS sync requests.

## Supabase Local Database Tests

Run the self-contained local database gate:

```bash
npm run supabase:test
```

This starts the local Supabase database if needed, resets and replays the complete migration chain, then runs every tenant, authority, locale, supplier-recipient, workflow, limit, and function-catalog pgTAP suite. On macOS it stages only the non-secret test sources in the system temporary directory, so Docker does not need broad access to the checkout.

## Pass Criteria

Mise is ready for an independent private-beta walkthrough when:

- Demo data opens directly from Login.
- Today explains the next best action without developer narration.
- Inventory, Orders, Insights, Setup, Settings, POS readiness, and Recipe readiness are understandable on a phone.
- Approve/dismiss/undo/order-copy/sent-history workflows work safely.
- Demo restore returns the configured sample dataset.
- `npm run verify:beta` passes.
- The full hosted security gate passes before real restaurant accounts are invited.
