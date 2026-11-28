create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' outreach_enrollment_last_sent_at_evidence.test.sql
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
  'enforce_outreach_enrollment_last_sent_at_evidence',
  'outreach enrollment last_sent_at evidence guard exists'
);

-- Parent campaign + lead fixtures for enrollment FK targets.
insert into public.outreach_campaigns (
  id, name, sender_name, sender_email, reply_to, company_postal_address,
  audience_description, value_proposition, status
) values (
  'e0000000-0000-4000-8000-000000000001',
  'Outreach Enrollment Last-Sent-At Evidence Campaign',
  'Mise Ops',
  'ops-enrollment-last-sent@mise.test',
  'ops-enrollment-last-sent@mise.test',
  '100 Kitchen Lane, Austin, TX 78701',
  'Independent restaurants that need inventory ops',
  'Calm operating intelligence for independent restaurants',
  'draft'
);

insert into public.outreach_leads (
  id, business_name, email, source_url, contact_basis, status
) values
  (
    'e0000000-0000-4000-8000-000000000101',
    'Enrollment Last-Sent Null Cafe',
    'enrollment-last-sent-null@mise.test',
    'https://example.com/enrollment-last-sent-null',
    'public_business_contact',
    'new'
  ),
  (
    'e0000000-0000-4000-8000-000000000102',
    'Enrollment Last-Sent Ok Cafe',
    'enrollment-last-sent-ok@mise.test',
    'https://example.com/enrollment-last-sent-ok',
    'public_business_contact',
    'new'
  ),
  (
    'e0000000-0000-4000-8000-000000000103',
    'Enrollment Last-Sent Queued Cafe',
    'enrollment-last-sent-queued@mise.test',
    'https://example.com/enrollment-last-sent-queued',
    'public_business_contact',
    'new'
  ),
  (
    'e0000000-0000-4000-8000-000000000104',
    'Enrollment Last-Sent Ready Cafe',
    'enrollment-last-sent-ready@mise.test',
    'https://example.com/enrollment-last-sent-ready',
    'public_business_contact',
    'new'
  ),
  (
    'e0000000-0000-4000-8000-000000000105',
    'Enrollment Last-Sent Completed Cafe',
    'enrollment-last-sent-completed@mise.test',
    'https://example.com/enrollment-last-sent-completed',
    'public_business_contact',
    'new'
  ),
  (
    'e0000000-0000-4000-8000-000000000106',
    'Enrollment Last-Sent Update Ok Cafe',
    'enrollment-last-sent-update-ok@mise.test',
    'https://example.com/enrollment-last-sent-update-ok',
    'public_business_contact',
    'new'
  ),
  (
    'e0000000-0000-4000-8000-000000000107',
    'Enrollment Last-Sent Update Null Cafe',
    'enrollment-last-sent-update-null@mise.test',
    'https://example.com/enrollment-last-sent-update-null',
    'public_business_contact',
    'new'
  ),
  (
    'e0000000-0000-4000-8000-000000000108',
    'Enrollment Last-Sent Explicit Null Cafe',
    'enrollment-last-sent-explicit-null@mise.test',
    'https://example.com/enrollment-last-sent-explicit-null',
    'public_business_contact',
    'new'
  );

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status
    ) values (
      'e0000000-0000-4000-8000-000000000201',
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000101',
      'contacted'
    )
  $sql$),
  'Outreach enrollment send time is required',
  'direct outreach_enrollments insert cannot mint contacted status without last_sent_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status, last_sent_at
    ) values (
      'e0000000-0000-4000-8000-000000000202',
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000102',
      'contacted',
      now()
    )
  $sql$),
  null,
  'direct outreach_enrollments insert with last_sent_at remains allowed for contacted status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status
    ) values (
      'e0000000-0000-4000-8000-000000000203',
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000103',
      'queued'
    )
  $sql$),
  null,
  'direct outreach_enrollments insert can open queued without send time'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status
    ) values (
      'e0000000-0000-4000-8000-000000000204',
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000104',
      'ready'
    )
  $sql$),
  null,
  'direct outreach_enrollments insert can mint ready without last_sent_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status
    ) values (
      'e0000000-0000-4000-8000-000000000205',
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000105',
      'completed'
    )
  $sql$),
  null,
  'direct outreach_enrollments insert can mint completed without last_sent_at'
);

insert into public.outreach_enrollments (
  id, campaign_id, lead_id, status
) values (
  'e0000000-0000-4000-8000-000000000206',
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000106',
  'queued'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_enrollments
    set status = 'contacted',
      last_sent_at = now(),
      updated_at = now()
    where id = 'e0000000-0000-4000-8000-000000000206'
      and status = 'queued'
  $sql$),
  null,
  'send UPDATE with last_sent_at remains allowed (INSERT-only tip)'
);

insert into public.outreach_enrollments (
  id, campaign_id, lead_id, status
) values (
  'e0000000-0000-4000-8000-000000000207',
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000107',
  'queued'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_enrollments
    set status = 'contacted',
      updated_at = now()
    where id = 'e0000000-0000-4000-8000-000000000207'
      and status = 'queued'
      and last_sent_at is null
  $sql$),
  null,
  'send UPDATE without last_sent_at remains allowed (INSERT-only tip)'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status, last_sent_at
    ) values (
      'e0000000-0000-4000-8000-000000000208',
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000108',
      'contacted',
      null
    )
  $sql$),
  'Outreach enrollment send time is required',
  'direct outreach_enrollments insert cannot mint contacted status with explicit null last_sent_at'
);

select * from finish();
rollback;
