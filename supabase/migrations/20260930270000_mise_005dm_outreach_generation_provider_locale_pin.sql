-- MISE-005DM: pin public.outreach_messages.generation_provider CHECK to
-- COLLATE "C", preserving the exact-token allowlist
-- openai / deterministic_fallback.
--
-- outreach_messages.generation_provider stores outreach draft generation
-- provider vocabulary under a bare IN allowlist from outreach_agent:
--   generation_provider in ('openai', 'deterministic_fallback')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'openai'                  — structured LLM draft path
--   'deterministic_fallback'  — deterministic non-LLM draft path
--
-- generation_provider gates draft provenance, operator review of which
-- path produced a message, and audit continuity for outreach sends.
-- POSIX character classes follow database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster; open
-- sibling outreach pins (#420/#421 email, #443 URL, #463 timezone,
-- #469/#470 provider message/event ids, #471 idempotency_key) leave
-- generation_provider on bare IN only. Open tip #524 explicitly deferred
-- this column.
--
-- If LC_CTYPE drifted under a bare-IN generation_provider CHECK,
-- dump/restore could accept generation-provider bytes the restored
-- C-locale path (and sibling machine-identity gates) would refuse — or
-- the reverse — breaking outreach draft provenance continuity across
-- restore.
--
-- Scope:
--   - Replace outreach_messages_generation_provider_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite outreach-agent edge writers, message status,
-- subject/body bounds, model_name, idempotency_key (#471),
-- provider_message_id (#470), purchase_lines.source, or other bare-IN
-- vocabularies. Timestamp after MISE-005DL (#524).

alter table public.outreach_messages
  drop constraint if exists outreach_messages_generation_provider_check;

alter table public.outreach_messages
  add constraint outreach_messages_generation_provider_check
  check (
    generation_provider in ('openai', 'deterministic_fallback')
    and generation_provider collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_messages_generation_provider_check
  on public.outreach_messages is
  'MISE-005DM: exact openai/deterministic_fallback allowlist plus ASCII shape under COLLATE "C". Outreach message generation provider.';

comment on column public.outreach_messages.generation_provider is
  'Outreach draft generation provider. Allowed values: openai, deterministic_fallback under COLLATE "C".';
