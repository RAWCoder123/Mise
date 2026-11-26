# Inventory reason_code slug evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-reason-code-slug-evidence-main`

## Gap

`public.record_inventory_event` accepted any free-text `p_reason_code` after
trim. A manager JWT could therefore mint inventory ledger rows with spaces,
punctuation, mixed case, or one-off phrases, rewriting on-hand under the
matching event semantics while forging Activity / reason-code provenance that
cannot be compared.

Operational mode changes already require `^[a-z0-9_]{3,64}$`. Product writers
that stamp inventory reasons use lowercase snake_case codes of that form.

## Change

- Domain: reject `invalid_reason_code_shape` when a present (non-blank)
  `reasonCode` does not match `^[a-z0-9_]{3,64}$`. Null / blank stay allowed.
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_reason_code_slug_evidence` with the same rule,
  plus a NOT VALID CHECK that skips legacy rows.
- Transport maps hosted `22023` messages ahead of the generic evidence matcher.
- pgTAP plan=10 from assertion call sites: space/case/short/hyphen/long
  rejects, matching accept, null unconstrained, and direct-insert reject.

## Alone-OK

Orthogonal to waste/stockout/transfer/correction reason allowlists
(#1270/#1271/#1276/#1274) — their accepted codes are already valid slugs —
other-reason notes (#1275), length-only evidence bounds (#1261), source
allowlists (#1259–#1269), transfer location/quantity tips (#1277/#1278), and
purchase-line #1238/#1250–#1258.

Contested merge: case-variant fixtures such as `Spoilage` in allowlist tips
may hit this slug guard first once both land (error message differs;
allowlist still covers invalid tokens like `prep` that are valid slugs).
#1261 oversized free-text fixtures longer than 64 chars also fail this shape
check.

Does **not** require a reason on every event type, invent new allowlist
taxonomies, or rewrite legacy rows.

## Verification

- `npm run typecheck`
- focused reason-code-slug suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
