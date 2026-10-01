-- MISE-005EL: pin public.insights free-form content CHECKs to reject
-- control characters under COLLATE "C".
--
-- insights_content_bounds_check only enforced length bounds on title,
-- description, recommended_action, and why_it_matters. It had no
-- control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- These four columns are durable operator-facing insight body text. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore
-- could accept insight bytes a restored C-locale path would refuse — or
-- the reverse — breaking insight continuity across restore.
--
-- Scope:
--   - Reattach insights_content_bounds_check preserving the exact length
--     bounds PLUS ASCII control rejection under COLLATE "C"
-- Does NOT rewrite insight commit writers, insight_type/severity (#515),
-- generation_source (#485), ai_insights provenance (#483), or
-- supplier_orders.operator_note (multiline-aware tip remains separate).
-- Timestamp after MISE-005EK (#549).

alter table public.insights
  drop constraint if exists insights_content_bounds_check;

alter table public.insights
  add constraint insights_content_bounds_check check (
    length(trim(title)) between 1 and 240
    and title collate "C" !~ '[[:cntrl:]]'
    and length(trim(description)) between 1 and 4000
    and description collate "C" !~ '[[:cntrl:]]'
    and length(trim(recommended_action)) between 1 and 2000
    and recommended_action collate "C" !~ '[[:cntrl:]]'
    and (
      why_it_matters is null
      or (
        length(why_it_matters) <= 2000
        and why_it_matters collate "C" !~ '[[:cntrl:]]'
      )
    )
  );

comment on constraint insights_content_bounds_check on public.insights is
  'MISE-005EL: insight title/description/recommended_action/why_it_matters length bounds plus ASCII control rejection under COLLATE "C".';
