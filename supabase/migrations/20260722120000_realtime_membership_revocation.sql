-- Realtime membership revocation (P3a) + bounded recommendation-history index (P4).
--
-- The client previously discovered membership revocations through a 10-second
-- poll of restaurant_memberships. This migration publishes ONLY
-- restaurant_memberships to the supabase_realtime publication so the app can
-- subscribe to its own membership rows and react to grants/revocations
-- immediately. RLS still applies to Realtime payloads: "Users can read own
-- memberships" limits events to the subscriber's own rows (or restaurants
-- they own/admin), so no cross-tenant data leaks through the socket.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

-- Full replica identity so DELETE events still carry user_id/restaurant_id,
-- which the client-side `user_id=eq.<uid>` subscription filter needs.
alter table public.restaurant_memberships replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurant_memberships'
  ) then
    alter publication supabase_realtime add table public.restaurant_memberships;
  end if;
end
$$;

-- Recompute paths now read bounded recommendation history
-- (restaurant_id + created_at cutoff) and status-filtered lists
-- (restaurant_id + status, newest first). Cover both access paths.
create index if not exists idx_purchase_recommendations_restaurant_created
on public.purchase_recommendations (restaurant_id, created_at desc);

create index if not exists idx_purchase_recommendations_restaurant_status_created
on public.purchase_recommendations (restaurant_id, status, created_at desc);
