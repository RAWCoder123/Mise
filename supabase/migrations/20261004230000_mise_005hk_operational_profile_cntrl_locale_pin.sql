-- MISE-005HK: pin private.restaurant_operational_profile_is_valid text and
-- allowlist gates to COLLATE "C".
--
-- public.restaurants.operational_profile is validated by
-- private.restaurant_operational_profile_is_valid, which currently bounds
-- orderCadence / prepWindows / primarySuppliers / inventoryReviewDays string
-- entries by length only, compares serviceStyle with a bare IN allowlist, and
-- bounds notes by length only with no control-character gate. Bare POSIX
-- [[:cntrl:]] / bare IN follow database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'` and allowlists under
-- COLLATE "C".
--
-- Array entries and serviceStyle are durable single-line operational tokens
-- (cadence labels, prep windows, supplier display names, review-day labels,
-- service-style vocabulary). They must not accept LF/TAB/CR/NUL. Notes are
-- operator free-form multiline prose, so they use the established
-- operator-note / supplier-send multiline allowlist (allow LF/TAB/CR; reject
-- other C0 controls and DEL) under COLLATE "C".
--
-- If LC_CTYPE drifted under length-only gates, dump/restore could accept
-- profile bytes a restored C-locale path would refuse — or the reverse —
-- breaking restaurant operating-profile continuity across restore.
--
-- Scope:
--   - Rewrite private.restaurant_operational_profile_is_valid so:
--       * array entry strings reject ASCII controls under COLLATE "C"
--       * serviceStyle allowlist compares under COLLATE "C"
--       * notes reject unsafe controls under COLLATE "C" while allowing
--         LF/TAB/CR (same byte class as MISE-005EM operator_note)
--   - Preserve service_role EXECUTE; public/anon/authenticated revoked
-- Does NOT rewrite private.update_restaurant_profile, restaurants.name
-- (#548 / MISE-005EJ), address/cuisine (#549 / MISE-005EK), logo_url
-- (#437 / MISE-005AC), timezone (#462 / MISE-005BB), currency (#436), or
-- structured AI insight output (#626 / MISE-005HJ). Timestamp after
-- MISE-005HJ (#626).

create or replace function private.restaurant_operational_profile_is_valid(p_profile jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  array_key text;
  array_entry jsonb;
  array_text text;
  notes_text text;
  style_text text;
begin
  if p_profile is null
    or pg_catalog.jsonb_typeof(p_profile) <> 'object'
    or pg_catalog.octet_length(p_profile::text) > 16384
    or p_profile - array[
      'serviceStyle', 'orderCadence', 'prepWindows',
      'primarySuppliers', 'inventoryReviewDays', 'notes'
    ] <> '{}'::jsonb
  then
    return false;
  end if;

  if p_profile ? 'serviceStyle' then
    if pg_catalog.jsonb_typeof(p_profile -> 'serviceStyle') <> 'string' then
      return false;
    end if;
    style_text := p_profile ->> 'serviceStyle';
    if style_text collate "C" not in (
      'quick_service', 'fast_casual', 'full_service', 'bar', 'cafe', 'ghost_kitchen'
    ) then
      return false;
    end if;
  end if;

  foreach array_key in array array[
    'orderCadence', 'prepWindows', 'primarySuppliers', 'inventoryReviewDays'
  ] loop
    if p_profile ? array_key then
      if pg_catalog.jsonb_typeof(p_profile -> array_key) <> 'array'
        or pg_catalog.jsonb_array_length(p_profile -> array_key) > 20
      then
        return false;
      end if;
      for array_entry in
        select element.value
        from pg_catalog.jsonb_array_elements(p_profile -> array_key) element(value)
      loop
        array_text := array_entry #>> '{}';
        if pg_catalog.jsonb_typeof(array_entry) <> 'string'
          or pg_catalog.length(array_text) not between 1 and 160
          or array_text collate "C" ~ '[[:cntrl:]]'
        then
          return false;
        end if;
      end loop;
    end if;
  end loop;

  if p_profile ? 'notes'
    and p_profile -> 'notes' <> 'null'::jsonb
  then
    if pg_catalog.jsonb_typeof(p_profile -> 'notes') <> 'string' then
      return false;
    end if;
    notes_text := p_profile ->> 'notes';
    if pg_catalog.length(notes_text) > 2000
      or notes_text collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    then
      return false;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function private.restaurant_operational_profile_is_valid(jsonb)
from public, anon, authenticated, service_role;
grant execute on function private.restaurant_operational_profile_is_valid(jsonb)
to service_role;

comment on function private.restaurant_operational_profile_is_valid(jsonb) is
  'MISE-005HK: restaurants.operational_profile validator with length bounds, COLLATE "C" ASCII control rejection on single-line array entries, COLLATE "C" serviceStyle allowlist, and multiline-aware control rejection on notes (allows LF/TAB/CR).';
