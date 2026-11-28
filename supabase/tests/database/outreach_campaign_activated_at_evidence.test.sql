create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' outreach_campaign_activated_at_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(9);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

select has_function(
  'private',
  'enforce_outreach_campaign_activated_at_evidence',
  'outreach campaign activated_at evidence guard exists'
);

-- Soft CHECK outreach_campaign_activation_approved requires approved_at when
-- status = 'active'. Stamp approved_at so the tip (not the soft CHECK) is the
-- fail-closed boundary under test.
select is(
  pg_temp.error_of($sql$
    insert into public.outreach_campaigns (
      id, name, sender_name, sender_email, reply_to, company_postal_address,
      audience_description, value_proposition, status, approved_at
    ) values (
      'd0000000-0000-4000-8000-000000000001',
      'Outreach Activated-At Evidence Active Null',
      'Mise Ops',
      'ops-activated-at-null@mise.test',
      'ops-activated-at-null@mise.test',
      '100 Kitchen Lane, Austin, TX 78701',
      'Independent restaurants that need inventory ops',
      'Calm operating intelligence for independent restaurants',
      'active',
      now()
    )
  $sql$),
  'Outreach campaign activation time is required',
  'direct outreach_campaigns insert cannot mint active status without activated_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_campaigns (
      id, name, sender_name, sender_email, reply_to, company_postal_address,
      audience_description, value_proposition, status, approved_at, activated_at
    ) values (
      'd0000000-0000-4000-8000-000000000002',
      'Outreach Activated-At Evidence Active Ok',
      'Mise Ops',
      'ops-activated-at-ok@mise.test',
      'ops-activated-at-ok@mise.test',
      '100 Kitchen Lane, Austin, TX 78701',
      'Independent restaurants that need inventory ops',
      'Calm operating intelligence for independent restaurants',
      'active',
      now(),
      now()
    )
  $sql$),
  null,
  'direct outreach_campaigns insert with activated_at remains allowed for active status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_campaigns (
      id, name, sender_name, sender_email, reply_to, company_postal_address,
      audience_description, value_proposition, status
    ) values (
      'd0000000-0000-4000-8000-000000000003',
      'Outreach Activated-At Evidence Draft',
      'Mise Ops',
      'ops-activated-at-draft@mise.test',
      'ops-activated-at-draft@mise.test',
      '100 Kitchen Lane, Austin, TX 78701',
      'Independent restaurants that need inventory ops',
      'Calm operating intelligence for independent restaurants',
      'draft'
    )
  $sql$),
  null,
  'direct outreach_campaigns insert can open draft without activation time'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_campaigns (
      id, name, sender_name, sender_email, reply_to, company_postal_address,
      audience_description, value_proposition, status, approved_at
    ) values (
      'd0000000-0000-4000-8000-000000000004',
      'Outreach Activated-At Evidence Paused',
      'Mise Ops',
      'ops-activated-at-paused@mise.test',
      'ops-activated-at-paused@mise.test',
      '100 Kitchen Lane, Austin, TX 78701',
      'Independent restaurants that need inventory ops',
      'Calm operating intelligence for independent restaurants',
      'paused',
      now()
    )
  $sql$),
  null,
  'direct outreach_campaigns insert can mint paused without activated_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_campaigns (
      id, name, sender_name, sender_email, reply_to, company_postal_address,
      audience_description, value_proposition, status
    ) values (
      'd0000000-0000-4000-8000-000000000005',
      'Outreach Activated-At Evidence Completed',
      'Mise Ops',
      'ops-activated-at-completed@mise.test',
      'ops-activated-at-completed@mise.test',
      '100 Kitchen Lane, Austin, TX 78701',
      'Independent restaurants that need inventory ops',
      'Calm operating intelligence for independent restaurants',
      'completed'
    )
  $sql$),
  null,
  'direct outreach_campaigns insert can mint completed without activated_at'
);

insert into public.outreach_campaigns (
  id, name, sender_name, sender_email, reply_to, company_postal_address,
  audience_description, value_proposition, status
) values (
  'd0000000-0000-4000-8000-000000000006',
  'Outreach Activated-At Evidence Update With Time',
  'Mise Ops',
  'ops-activated-at-update-ok@mise.test',
  'ops-activated-at-update-ok@mise.test',
  '100 Kitchen Lane, Austin, TX 78701',
  'Independent restaurants that need inventory ops',
  'Calm operating intelligence for independent restaurants',
  'draft'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_campaigns
    set status = 'active',
      approved_at = now(),
      activated_at = now(),
      updated_at = now()
    where id = 'd0000000-0000-4000-8000-000000000006'
      and status = 'draft'
  $sql$),
  null,
  'activate UPDATE with activated_at remains allowed (INSERT-only tip)'
);

insert into public.outreach_campaigns (
  id, name, sender_name, sender_email, reply_to, company_postal_address,
  audience_description, value_proposition, status
) values (
  'd0000000-0000-4000-8000-000000000007',
  'Outreach Activated-At Evidence Update Without Time',
  'Mise Ops',
  'ops-activated-at-update-null@mise.test',
  'ops-activated-at-update-null@mise.test',
  '100 Kitchen Lane, Austin, TX 78701',
  'Independent restaurants that need inventory ops',
  'Calm operating intelligence for independent restaurants',
  'draft'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_campaigns
    set status = 'active',
      approved_at = now(),
      updated_at = now()
    where id = 'd0000000-0000-4000-8000-000000000007'
      and status = 'draft'
      and activated_at is null
  $sql$),
  null,
  'activate UPDATE without activated_at remains allowed (INSERT-only tip)'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_campaigns (
      id, name, sender_name, sender_email, reply_to, company_postal_address,
      audience_description, value_proposition, status, approved_at, activated_at
    ) values (
      'd0000000-0000-4000-8000-000000000008',
      'Outreach Activated-At Evidence Active Explicit Null',
      'Mise Ops',
      'ops-activated-at-explicit-null@mise.test',
      'ops-activated-at-explicit-null@mise.test',
      '100 Kitchen Lane, Austin, TX 78701',
      'Independent restaurants that need inventory ops',
      'Calm operating intelligence for independent restaurants',
      'active',
      now(),
      null
    )
  $sql$),
  'Outreach campaign activation time is required',
  'direct outreach_campaigns insert cannot mint active status with explicit null activated_at'
);

select * from finish();
rollback;
