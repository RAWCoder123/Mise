-- Align table privileges with the existing RPC/Edge ownership model and pgTAP
-- expectations. Write policies were already dropped for restaurant_memberships
-- and public.users, but residual authenticated DML grants remained from early
-- multi-tenant scaffolding. Service-role and SECURITY DEFINER writers are
-- unaffected; authenticated clients keep SELECT where RLS still allows reads.

revoke insert, update, delete on table public.restaurant_memberships from authenticated;

revoke update on table public.users from authenticated;

comment on table public.restaurant_memberships is
  'Restaurant role memberships. Authenticated clients have SELECT only; mutations are service/Edge owned RPCs.';

comment on table public.users is
  'Operator profiles. Authenticated clients have SELECT only; profile and locale mutations are service/Edge owned RPCs.';
