-- MISE-005HY: pin public.outreach_agent_runs.error_summary CHECK to reject
-- unsafe control characters under COLLATE "C", while allowing multiline
-- free-form summaries.
--
-- outreach_agent_runs.error_summary was declared as unbounded nullable text
-- with no length or control-character gate. Current writers persist:
--   summary.errors.slice(0, 5).join(" ").slice(0, 1_000)
--   safeError(error)  -- Error.message / object.message sliced to 500
-- Bare POSIX [[:cntrl:]] would also reject LF (and the established
-- supplier-send / operator-note / action_outcomes.lesson multiline
-- allowlist), so this tip uses the same byte class as
-- services/miseValidation.ts `unsafeSupplierSendMultilineControlPattern`:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established multiline control pattern.
--
-- error_summary is durable free-form run failure / partial-error text on
-- service-only Mise sales outreach agent runs. When present it may contain
-- intentional newlines from joined operator-facing error fragments. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept error_summary bytes a restored C-locale path would refuse — or the
-- reverse — breaking outreach run continuity across restore.
--
-- Scope:
--   - Attach outreach_agent_runs_error_summary_check as null OR
--     length(trim(error_summary)) 1..1000 PLUS multiline-aware ASCII
--     control rejection under COLLATE "C"
-- Does NOT rewrite outreach-agent Edge Function writers, trigger_type /
-- status CHECKs (#528), campaigns_checked / drafts_created / messages_sent /
-- blocked_count bounds, or sibling outreach_messages tips (#640/#639/#638–
-- #635). Alone-OK versus those open tips.
-- Timestamp after MISE-005HX (#640).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.outreach_agent_runs'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'outreach_agent_runs_error_summary_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%error_summary%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%campaigns_checked%'
          and pg_get_constraintdef(con.oid) not ilike '%drafts_created%'
          and pg_get_constraintdef(con.oid) not ilike '%messages_sent%'
          and pg_get_constraintdef(con.oid) not ilike '%blocked_count%'
          and pg_get_constraintdef(con.oid) not ilike '%started_at%'
          and pg_get_constraintdef(con.oid) not ilike '%completed_at%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.outreach_agent_runs drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.outreach_agent_runs
  drop constraint if exists outreach_agent_runs_error_summary_check;

alter table public.outreach_agent_runs
  add constraint outreach_agent_runs_error_summary_check check (
    error_summary is null
    or (
      length(trim(error_summary)) between 1 and 1000
      and error_summary collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint outreach_agent_runs_error_summary_check
  on public.outreach_agent_runs is
  'MISE-005HY: outreach_agent_runs error_summary null or length(trim) 1..1000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
