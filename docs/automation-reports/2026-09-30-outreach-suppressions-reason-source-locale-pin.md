# MISE-005DO: outreach_suppressions reason/source locale pin

Date: 2026-09-30

## Goal

Pin `public.outreach_suppressions.reason` and
`public.outreach_suppressions.source` CHECK constraints to exact-token
allowlists plus ASCII shape under `COLLATE "C"`, matching the MISE-005A
locale-pin cluster pattern.

## Tokens

Reason:

- `recipient_request`
- `hard_bounce`
- `spam_complaint`
- `provider_suppression`
- `manual`

Source:

- `unsubscribe`
- `resend_webhook`
- `operator`

## Scope

CHECK-only additive migration. Does not rewrite:

- `service_unsubscribe_outreach`
- outreach-webhook / outreach-agent edge writers
- `outreach_messages.generation_provider` (#525)
- `purchase_lines.source` (#526)
- other bare-IN vocabularies

## Evidence

- Migration: `supabase/migrations/20260930290000_mise_005do_outreach_suppressions_reason_source_locale_pin.sql`
- Static test: `tests/outreachSuppressionsReasonSourceLocalePin.test.ts`
- pgTAP: `supabase/tests/database/outreach_suppressions_reason_source_locale_pin.test.sql` (plan 24 from 24 assertion call sites)

## Verification

See commit message / PR for typecheck and focused test results. Docker
pgTAP not run in this environment.
