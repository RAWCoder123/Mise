# MISE-005NK finding-decision evidence type ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-finding-decision-evidence-type-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing defect

Shared `normalizeEvidence` used Unicode `requireBoundedText` on evidence
`type`, then checked the trimmed token against the closed evidence-type
allowlist. NBSP/em-space padding invented a valid enum token on both input and
response paths:

```text
'\u00a0inventory_item\u00a0'.trim() === 'inventory_item'
```

ASCII-C canonicalize returns `null` for the same padded value, so the allowlist
never sees an invented token.

## Change

- Added `services/domain/operationalFindingDecisionEvidenceTypeIdentity.ts`
- Routed evidence `type` through
  `requireCanonicalOperationalFindingDecisionEvidenceType`
- Preserved `Finding evidence type is invalid.` and the 80-character bound
- Left evidence id/summary, restaurant workspace, `finding.id.trim()`, object
  identities, and outbox tips alone

## Verification

- Focused `operationalFindingDecisionEvidenceTypeAsciiC` tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK. When landing with #790/#791/#792, drop cross-assertions that sibling
fields still Unicode-trim.
