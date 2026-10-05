# MISE-005IF: outreach_suppressions.email locale pin

## Summary

Additive CHECK-only migration attaches
`outreach_suppressions_email_check` as

```sql
email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
```

The foundation column was unbound `email text not null` with no shape gate.
MISE-005L re-pinned `outreach_leads.email` and both tables'
`email_normalized` keys; MISE-005M pinned campaign From/Reply-To. Both left
`outreach_suppressions.email` unbound. Writers copy the lead mailbox
(unsubscribe RPC and outreach-webhook), so the CHECK locks the same ASCII C
`[[:space:]]` rejection as sibling email tips for dump/restore continuity.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves `email_normalized` (#420), `reason` / `source` (#527), leads email
  (#420), and campaign sender/reply (#421) untouched
- Alone-OK versus open #420 / #421 / #527 / #647

## Verification

- `npm run typecheck` — pass
- focused `outreachSuppressionsEmailLocalePin` — 3/3 pass
- `npm test` — 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` withTimeout hang)
- pgTAP plan 8 from 8 assertion call sites (Docker/pgTAP unavailable when
  the socket is absent)
