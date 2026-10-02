-- MISE-005EW: pin public.operational_issues.title CHECK to reject control
-- characters under COLLATE "C".
--
-- operational_issues.title only enforced
--   length(trim(title)) between 1 and 160
-- It had no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Issue title is durable single-line operator-attention text on the
-- operational issues ledger. If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept title bytes a restored C-locale path
-- would refuse — or the reverse — breaking issue-evidence continuity across
-- restore.
--
-- Scope:
--   - Reattach operational_issues_title_check preserving the exact
--     length(trim(title)) between 1 and 160 bound PLUS ASCII control
--     rejection under COLLATE "C"
-- Does NOT rewrite the purchase_recommendations sync trigger, explanation /
-- dedupe_key bounds, category (#507) / severity (#508) / status (#509)
-- allowlists, activity_events.title (#560), or restaurant_tasks.title (#556).
-- Timestamp after MISE-005EV (#560).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.operational_issues'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'operational_issues_title_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%title%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%title%'
          and pg_get_constraintdef(con.oid) not ilike '%explanation%'
          and pg_get_constraintdef(con.oid) not ilike '%dedupe_key%'
          and pg_get_constraintdef(con.oid) not ilike '%category%'
          and pg_get_constraintdef(con.oid) not ilike '%severity%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.operational_issues drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.operational_issues
  drop constraint if exists operational_issues_title_check;

alter table public.operational_issues
  add constraint operational_issues_title_check check (
    length(trim(title)) between 1 and 160
    and title collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint operational_issues_title_check on public.operational_issues is
  'MISE-005EW: operational issue title length(trim) 1..160 plus ASCII control rejection under COLLATE "C".';
