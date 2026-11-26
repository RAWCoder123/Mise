# Inventory blank source_reference evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-blank-source-reference-evidence-main`

## Gap

`public.inventory_events.source_reference` is optional and unbounded on current
main. Hosted `record_inventory_event` already nullif-trims blank values before
insert, but every other insert path (direct service inserts, count-session
approval, demo/outbox accept) can still stamp whitespace-only or padded
`source_reference` text onto the append-only ledger.

Blank padding invents a parallel identity beside null / the trimmed label, so
outbox replay can conflict with the hosted nullif-trim store and Activity /
write-path provenance cannot treat padding as a real reference.

## Change

- Domain: `invalid_source_reference_shape` via `validateSourceReferenceEvidence`
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_blank_source_reference_evidence` requiring null or
  trimmed non-empty / unpadded text
- NOT VALID CHECK mirrors the same rule without rewriting history
- Transport maps hosted `22023` messages ahead of the generic evidence matcher
- pgTAP plan=10 from assertion call sites (spaces/tabs/padded direct rejects,
  RPC blank nullify + padded trim accept, trimmed + null direct accept)

## Alone-OK

Orthogonal to source slug #1281, reason-code slug #1279, actor_user_id #1280,
transfer location/quantity #1277/#1278, reason/source allowlists #1259–#1276,
other-reason notes #1275, evidence length bounds #370/#1261, ASCII-C operator
reference pin #855, and purchase-line #1238/#1250–#1258. Does not rewrite
`record_inventory_event` or `reject_inventory_event_mutation`.

Contested merge: none expected with length-only bounds (those reject oversized
strings; this tip rejects blank/padded shape).

## Verification

- `npm run typecheck` — passed
- focused blank source_reference suite — 6/6 passed
- `npm test` — 682 passed / 0 fail / 7 cancelled (inherited withTimeout)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
