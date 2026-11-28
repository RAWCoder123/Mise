-- Outreach campaign inserts that claim active must carry activated_at.
--
-- `public.outreach_campaigns.activated_at` is nullable because draft / paused /
-- completed rows legitimately leave it null until a later activate UPDATE
-- stamps the timestamp. Soft table constraints only require approved_at when
-- status = 'active' (outreach_campaign_activation_approved). They do not
-- require activated_at when status claims active. Hosted activateCampaign
-- already stamps both approved_at and activated_at on UPDATE into status =
-- 'active', but any INSERT that reaches the table can still mint an active
-- campaign with activated_at null.
--
-- Authenticated client DML is revoked; service_role retains INSERT and can
-- still mint untimed active claims directly. Create writers INSERT status =
-- 'draft' with activated_at null until a later activate path stamps evidence
-- on UPDATE.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'active' and activated_at is null. Draft / paused /
-- completed inserts and activate UPDATEs remain allowed — there is
-- intentionally no NOT NULL / status-implies-timestamp CHECK, because a CHECK
-- would expand beyond this INSERT-only tip boundary.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite outreach-agent writers. History is never rewritten.
-- Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1331, including outreach message sent_at
-- (#1328), outreach agent run completed_at (#1329), and Square / Gmail OAuth
-- claim-time evidence (#1330 / #1331). Soft contested merge: none expected.

create or replace function private.enforce_outreach_campaign_activated_at_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'active'
    and new.activated_at is null
  then
    raise exception
      'Outreach campaign activation time is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists outreach_campaigns_activated_at_evidence
  on public.outreach_campaigns;
create trigger outreach_campaigns_activated_at_evidence
before insert on public.outreach_campaigns
for each row execute function private.enforce_outreach_campaign_activated_at_evidence();

revoke all on function private.enforce_outreach_campaign_activated_at_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_outreach_campaign_activated_at_evidence() is
  'Fail closed: outreach_campaigns INSERT requires a non-null activated_at when status is active. Draft/paused/completed inserts and activate UPDATEs remain permitted.';
