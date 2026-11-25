# Purchase-line credit attachments (2026-11-25)

## Summary

Managers can verify a post-hoc attachment from an unlinked credit purchase line
to the same-supplier purchase line it offsets. Document-stated
`purchase_lines.credits_line_id` remains immutable and is never rewritten.

## Why

MISE-004C allows `credits_line_id` only when the source document names the
original line. Credits that omit that reference stay permanently unlinked on
the append-only ledger. Operators needed a fail-closed, revocable way to record
the offset without mutating history or inventing fuzzy matches.

## Scope

- Additive table `purchase_line_credit_attachments` (RLS select-only)
- SECURITY DEFINER RPCs `attach_purchase_line_credit` /
  `revoke_purchase_line_credit_attachment`
- Demo/hosted repository parity
- More → Attach invoice credits UI (EN / ES / zh-Hans)
- Export + security allowlists
- Domain / demo / migration / pgTAP tests

## Alone-OK

Complementary to #1238 browse, #1250 inventory links, #1251 manual entry,
#1252 item-key aliases, #1253 correction, #1254 seed, #1255/#1256 spend
grounding. Activity vocabulary includes sibling link/alias event names for
merge-order safety. No FEFO, receive, or purchase-authority changes.

## Verification

See PR test plan.
