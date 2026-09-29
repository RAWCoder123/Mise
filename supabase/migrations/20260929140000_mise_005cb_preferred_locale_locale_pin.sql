-- MISE-005CB: pin public.users.preferred_locale CHECK and
-- update_my_preferred_locale writer gate to COLLATE "C".
--
-- public.users stores preferred_locale under a bare IN allowlist from
-- add_operator_locale_preference:
--   preferred_locale is null or preferred_locale in ('en', 'es', 'zh-Hans')
-- public.update_my_preferred_locale mirrors that with bare:
--   p_locale not in ('en', 'es', 'zh-Hans')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII locale tokens only:
--   'en'      — English
--   'es'      — Spanish
--   'zh-Hans' — Simplified Chinese
--
-- preferred_locale is operator display preference only — never an authorization
-- input. Restaurant authority remains exclusively in active
-- restaurant_memberships. The identity-free RPCs remain auth.uid()-bound.
--
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005*
-- tips pinned machine-identity and provenance allowlists under COLLATE "C",
-- but left the operator preferred_locale bare-IN CHECK and writer gate
-- unpinned.
--
-- If LC_CTYPE drifted under a bare-IN preferred_locale CHECK, dump/restore
-- could accept preference bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking operator
-- language preference continuity across restore. The same drift on the writer
-- gate could accept bytes the CHECK would refuse (or the reverse).
--
-- Scope:
--   - Replace users_preferred_locale_allowlist_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C":
--       preferred_locale is null
--       or (
--         preferred_locale in ('en', 'es', 'zh-Hans')
--         and preferred_locale collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
--       )
--   - Rewrite public.update_my_preferred_locale so the allowlist gate uses
--     the same COLLATE "C" contract
--   - Preserve revoke from public/anon/authenticated/service_role + grant
--     EXECUTE to authenticated only (matches original migration)
-- Does NOT rewrite get_my_preferred_locale, users RLS, restaurant locale
-- settings, i18n catalog, activity_events, or restaurant_memories.
-- Alone on main OK. Timestamp after MISE-005CA (#487).

alter table public.users
  drop constraint if exists users_preferred_locale_allowlist_check;

alter table public.users
  add constraint users_preferred_locale_allowlist_check
  check (
    preferred_locale is null
    or (
      preferred_locale in ('en', 'es', 'zh-Hans')
      and preferred_locale collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
    )
  );

comment on constraint users_preferred_locale_allowlist_check
  on public.users is
  'MISE-005CB: exact en/es/zh-Hans allowlist plus ASCII shape under COLLATE "C". Operator display preference only; never authorization.';

comment on column public.users.preferred_locale is
  'Operator display preference only. Allowed values: en, es, zh-Hans under COLLATE "C". Never use for restaurant authorization.';

-- The caller supplies only an allowlisted locale. The target profile always
-- comes from auth.uid(); user, restaurant, role, and membership fields cannot
-- be selected or changed through this function.
create or replace function public.update_my_preferred_locale(p_locale text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  updated_locale text;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_locale is null
    or p_locale not in ('en', 'es', 'zh-Hans')
    or p_locale collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'
  then
    raise exception 'Preferred locale is not supported' using errcode = '22023';
  end if;

  update public.users profile
  set preferred_locale = p_locale
  where profile.id = actor_user_id
  returning profile.preferred_locale into updated_locale;

  if updated_locale is null then
    raise exception 'Authenticated profile is unavailable' using errcode = 'P0002';
  end if;

  return updated_locale;
end;
$$;

comment on function public.update_my_preferred_locale(text) is
  'MISE-005CB: identity-free preferred_locale write under exact en/es/zh-Hans allowlist plus COLLATE "C" ASCII shape; auth.uid() is the only profile target.';

-- Keep profile mutation RPC-only. Existing authenticated SELECT remains
-- protected by the own-profile RLS policy; no direct UPDATE capability is added.
revoke update (preferred_locale) on table public.users from authenticated;

revoke all on function public.update_my_preferred_locale(text) from public, anon, authenticated, service_role;

grant execute on function public.update_my_preferred_locale(text) to authenticated;
