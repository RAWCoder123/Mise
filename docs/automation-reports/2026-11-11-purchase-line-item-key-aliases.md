# Purchase-line item-key aliases (2026-11-11)

## Summary

Managers can verify an exact `normalized_item_key` alias so a credit memo that
used different wording from the invoice can net against the invoice group
without rewriting append-only ledger text and without fuzzy matching.

## Why

MISE-004C documents that netting groups by exact key and flags unmatched
credits when wording diverges. Invoice cost and spend views were truthful but
left those credits stranded. Exact manager-verified aliases are the fail-closed
resolution path.

## Scope

- Additive table `purchase_line_item_key_aliases` (RLS select-only for members)
- SECURITY DEFINER RPCs `alias_purchase_line_item_key` /
  `revoke_purchase_line_item_key_alias` (owner/admin/manager)
- One-hop resolution in `list_purchase_line_net_by_item`
- Demo/hosted parity, More hub UI (EN/ES/zh-Hans), export + security allowlists
- Domain/demo/migration/pgTAP tests

## Alone-OK

Complementary to #1238 browse, #1250 inventory links, #1251 manual entry, and
ingest guards #415/#398. Does not touch receive/FEFO/waste/count stacks.

Activity-event allowlist includes sibling link event names so either merge order
with #1250 keeps the CHECK complete; #1250 should keep the alias event names on
rebase if it lands second.

## Verification

- `npm run typecheck`
- Focused alias suites: 12/12
- `npm test`: 688 passed / 0 failed / 7 cancelled
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
