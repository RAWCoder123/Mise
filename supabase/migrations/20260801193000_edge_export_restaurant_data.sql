-- Restaurant-scoped data export / portability for App Store privacy readiness.
-- Owner/admin only; rate-limited through the shared Edge firewall.

alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_function_name_check;
alter table private.edge_function_security_events
  add constraint edge_function_security_events_function_name_check check (
    function_name in (
      'sync-pos-sales',
      'generate-ai-insights',
      'link-gmail',
      'gmail-oauth-callback',
      'send-supplier-email',
      'operational-workflows',
      'export-restaurant-data',
      'account-onboarding',
      'request-account-deletion'
    )
  );

create or replace function private.edge_function_policy(p_function_name text)
returns table (max_attempts integer, window_seconds integer, allowed_roles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select policy.max_attempts, policy.window_seconds, policy.allowed_roles
  from (
    values
      ('sync-pos-sales', 8, 60, array['owner', 'admin', 'manager']::text[]),
      ('generate-ai-insights', 6, 300, array['owner', 'admin', 'manager']::text[]),
      ('link-gmail', 4, 300, array['owner', 'admin']::text[]),
      ('gmail-oauth-callback', 4, 300, array['owner', 'admin']::text[]),
      ('send-supplier-email', 12, 60, array['owner', 'admin', 'manager']::text[]),
      ('operational-workflows', 60, 60, array['owner', 'admin', 'manager', 'staff']::text[]),
      -- Privacy export: owner/admin only, tighter than operational workflows.
      ('export-restaurant-data', 4, 300, array['owner', 'admin']::text[]),
      -- User-scoped: roles unused; reservation RPC authenticates by actor id only.
      ('account-onboarding', 12, 60, array[]::text[]),
      ('request-account-deletion', 4, 300, array[]::text[])
  ) policy(function_name, max_attempts, window_seconds, allowed_roles)
  where policy.function_name = p_function_name;
$$;

revoke all on function private.edge_function_policy(text) from public, anon, authenticated, service_role;

comment on function private.edge_function_policy(text) is
  'Edge firewall policy including export-restaurant-data (owner/admin, 4/300s).';
