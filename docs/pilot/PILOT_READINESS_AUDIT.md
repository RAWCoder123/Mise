# First restaurant launch-readiness audit

Audit baseline: `706590de293290d1dcfaf5bef82f27bd85c18fc5`

Target: one founder-assisted restaurant in hosted staging through invite-only TestFlight

Scope: current Mise operating loop only; no MISE-004B, autonomy expansion, or new provider

## Verdict

The current product has a reachable hosted path through all 22 stages. No new
P0 product defect was found. Three P1 launch blockers were found:

1. the normal test gate was red because four expectations had drifted from the
   current authority model or installed pgTAP signature;
2. the store-distributed TestFlight profile exposed local demo mode, allowing a
   pilot operator to enter a non-hosted workspace by mistake;
3. safe defaults left Square, drafting, and Gmail disabled, but founder/ops had
   no staging-pinned command to advance or stop those controls without writing
   SQL.

MISE-PILOT-001 fixes only those blockers. The remaining gaps below are P2/P3
concierge limitations or external acceptance prerequisites.

## Fresh-operator trace

| # | Stage | Reachable path and evidence | Prerequisite / recovery / safety | Class |
| ---: | --- | --- | --- | --- |
| 1 | Authentication | Founder creates a protected invite artifact with `beta:provision-owner`; owner accepts at `/accept-invite`, chooses a password, then signs in. No demo seed is involved. | Public signup remains disabled. Invalid/expired invite shows a bounded error; founder can reconcile or issue a new invitation. | Ready |
| 2 | Restaurant creation | `service_provision_beta_restaurant` creates one replay-safe tenant before invitation acceptance. | Founder-assisted by design; no SQL console. Provisioning keeps accepted tenants for reconciliation rather than deleting uncertain state. | Ready |
| 3 | Owner membership | Provisioning verifies an active owner membership and default-off restaurant controls. | Missing verification fails the command and stops onboarding. | Ready |
| 4 | Initial setup | Today produces profile/inventory setup tasks which route to `/setup`; the hosted setup saves profile, suppliers, inventory, recipes, recipients, and optional CSV rows atomically. | One initial snapshot; include the complete pilot inventory. Validation is bounded and retryable. | Ready, P2 concierge limitation |
| 5 | Supplier creation | Setup creates durable restaurant-scoped supplier IDs; Settings → Suppliers edits display names and recipients by ID. | New suppliers after initial setup require founder assistance; renames preserve identity and recipient. | Ready, P2 |
| 6 | Inventory creation | Setup creates inventory with supplier ID, unit, on-hand, par, and threshold. | Use recognized standard units during pilot. Setup does not collect unit cost; manual review/send still works, while future automation remains blocked. | Ready, P2 |
| 7 | Canonical-unit verification | Standard units are deterministically converted and verified by the database; Inventory visibly blocks count operations for unverified units. | There is no operator form for a nonstandard conversion. Normalize the pilot list to `g`, `kg`, `oz`, `lb`, `ml`, `l`, `each`, or another recognized standard unit before setup. | Ready, P2 |
| 8 | Square connection | Owner/admin uses Settings → POS → Connect Square; OAuth state/PKCE, Vault credential storage, tenant binding, location discovery, and reconnect/disconnect are server-side. | Requires real Square sandbox credentials and callback registration. Failure returns to POS with a retryable notice. | Ready; external acceptance pending |
| 9 | Location/catalog sync | Founder enables only Square sync, then owner/admin/manager runs the exact restaurant-local 28-day sync. Active locations and catalog identities are persisted. | All active Square locations participate; there is no location chooser. Restaurant #1 must have one intended active location or founder must verify every active location. | Ready, P2 |
| 10 | Provider mapping review | Settings → POS shows the mapping queue and links to `/settings/pos-mappings`; manager selects a Mise menu item and verifies or rejects exact provider identity. | Unreviewed/rejected identity remains non-authoritative. A failed review stays in queue and can be retried. | Ready |
| 11 | Recipes | Setup seeds recipe mappings; Settings → Recipes adds/edits compatible ingredient quantities. | Founder-assisted entry is acceptable. No AI extraction. | Ready |
| 12 | Recipe confirmation | Settings → Recipes exposes Confirm for the current menu-item recipe revision. | Later mapping/recipe change invalidates the confirmation and requires a new review. | Ready |
| 13 | Inventory count | Inventory → Start count creates a session; staff can count/submit and manager can approve. | Incomplete lines and unverified units block. A cancelled or failed session can be restarted. | Ready |
| 14 | Recommendation generation | Square sync/count/recipe changes regenerate hosted operational signals. Inventory detail also offers an explicit manual pending recommendation bootstrap. | MISE-generated demand needs trustworthy history and current authority. Missing history stays visible and must not be treated as zero. Manual bootstrap does not create MISE purchase-memory evidence. | Ready, truthful bootstrap |
| 15 | Approval / override | Orders → Review displays current authority, quantity input, blocker-specific recovery, approve, dismiss, undo, and override. | MISE-003A revalidates current line/draft evidence and fails closed. Drafting controls must be on. | Ready |
| 16 | Supplier recipient | Setup or Settings → Suppliers stores a validated same-tenant recipient by durable supplier ID. | Use a founder-controlled test recipient first. Recipient changes invalidate send content. | Ready |
| 17 | Gmail connection | Owner/admin uses Settings → Gmail; OAuth state/PKCE and refresh credential storage remain server-side. | Requires Google test user, exact callback, Gmail API, and consent configuration. Reauth/disconnect have visible recovery. | Ready; external acceptance pending |
| 18 | Send preview | Order detail loads server-built From, To, Subject, full body, line count, content version, and fingerprint. | Unavailable/stale authority, sender, or recipient produces a specific blocker and recovery link. | Ready |
| 19 | Full-content approval | The operator reviews the displayed body, then Approve & send submits the exact server fingerprint; the server re-previews before approval. | Any note/name/recipient/authority revision changes the fingerprint and requires fresh review. | Ready |
| 20 | Send claim | The service claims immutable supplier ID, recipient, subject/body, and fingerprint before Gmail. | In-progress and unknown results prohibit automatic retry; recipient/content mutation cannot redirect an existing claim. | Ready |
| 21 | Delivery completion | Gmail acceptance atomically finalizes sent state; Order detail later records the physical receipt and durable delivery evidence. | Definitive rejection may be retried only after correction/reapproval. Unknown acceptance requires provider investigation, never Send again. | Ready |
| 22 | Purchase decision memory | MISE-generated approve/override/dismiss transitions append immutable `purchase_decision_events`; repeated eligible patterns appear as advisory Orders context. | Manual recommendations deliberately do not create memory. One event is stored immediately; a visible pattern needs five consistent eligible decisions. Memory failure cannot make Orders unavailable. | Ready |

## Accepted pilot limitations

- Square and Gmail are the only live providers in scope.
- Live external acceptance is not claimed by local mocks; follow the staging
  checklist before GO.
- Setup is optimized for a complete first snapshot, not ongoing catalog
  administration.
- Nonstandard inventory conversions require pre-normalization/founder help.
- Active Square locations are discovered, not operator-selected.
- Positive unit cost improves readiness/spend estimates but is not required for
  the manually reviewed supplier-email loop.
- Purchase memory is advisory and becomes a visible pattern only after enough
  consistent MISE-generated decisions.

These limitations fail closed or are manageable by the founder for restaurant
#1; none justifies broadening this milestone.
