-- MISE-005DW: pin public.purchase_recommendations.urgency CHECK to COLLATE "C",
-- preserving the exact-token allowlist.
--
-- public.purchase_recommendations stores recommendation urgency under a bare
-- IN allowlist from secure_multi_tenant_rls:
--   urgency in ('low', 'medium', 'high')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'low'    — routine restock / coverage window
--   'medium' — elevated risk; prioritize review
--   'high'   — stockout / service risk; urgent review
--
-- purchase_recommendations.urgency drives operating-brief severity mapping,
-- recommendation RPCs, and operator prioritization. POSIX character classes
-- follow database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; open sibling pins through #534 leave
-- purchase_recommendations.urgency on bare IN. Open tip #534 pinned
-- purchase_recommendations.status and deferred this urgency column.
--
-- If LC_CTYPE drifted under a bare-IN purchase_recommendations.urgency
-- CHECK, dump/restore could accept urgency bytes the restored C-locale path
-- (and sibling recommendation / brief gates) would refuse — or the reverse —
-- breaking purchase-recommendation continuity across restore.
--
-- Scope:
--   - Replace purchase_recommendations_urgency_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite purchase-approval / dismiss / undo RPCs, generation_source
-- (#484), status allowlist (#534), purchase_orders.status (#519), or
-- purchase_decision_events writers. Timestamp after MISE-005DV (#534).

alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_urgency_check;

alter table public.purchase_recommendations
  add constraint purchase_recommendations_urgency_check
  check (
    urgency in (
      'low',
      'medium',
      'high'
    )
    and urgency collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_recommendations_urgency_check
  on public.purchase_recommendations is
  'MISE-005DW: exact low/medium/high allowlist plus ASCII shape under COLLATE "C". Purchase recommendation urgency.';

comment on column public.purchase_recommendations.urgency is
  'Purchase recommendation urgency. Allowed values: low, medium, high under COLLATE "C".';
