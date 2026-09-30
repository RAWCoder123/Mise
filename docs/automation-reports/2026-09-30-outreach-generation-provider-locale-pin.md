# MISE-005DM: pin outreach_messages.generation_provider CHECK to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-outreach-generation-provider-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `outreach_messages.generation_provider` allowlist
(`openai` / `deterministic_fallback`) with the exact-token contract plus
ASCII shape under COLLATE `"C"`:

```sql
generation_provider in ('openai', 'deterministic_fallback')
and generation_provider collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`supabase/functions/outreach-agent/index.ts`
`provider: "openai" | "deterministic_fallback"` and the outreach_agent
create-table allowlist):

- `openai` — structured LLM draft path
- `deterministic_fallback` — deterministic non-LLM draft path

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling outreach pins
(#420/#421 email, #443 URL, #463 timezone, #469/#470 provider ids, #471
idempotency_key) leave `generation_provider` on bare IN only. Tip #524
explicitly deferred this column. Without a dedicated COLLATE C shape CHECK,
dump/restore under LC_CTYPE drift can accept generation-provider bytes the
restored C-locale path would refuse — or the reverse — breaking outreach
draft provenance continuity across restore.

## Scope

- CHECK-only on `public.outreach_messages.generation_provider`
- Does **not** rewrite outreach-agent edge writers
- Does **not** touch message status, body bounds, model_name,
  idempotency_key (#471), provider_message_id (#470), or
  `purchase_lines.source`
- Alone on main OK; timestamp after #524 (`20260930270000`)

## Verification

- `npm run typecheck` pass
- focused `tests/outreachGenerationProviderLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DM cases pass)
- pgTAP fixture committed (plan 10 from 10 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930270000_mise_005dm_outreach_generation_provider_locale_pin.sql`
- `supabase/tests/database/outreach_generation_provider_locale_pin.test.sql`
- `tests/outreachGenerationProviderLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-outreach-generation-provider-locale-pin.md`
