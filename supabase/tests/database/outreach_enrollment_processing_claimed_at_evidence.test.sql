create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' outreach_enrollment_processing_claimed_at_evidence.test.sql
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
  'enforce_outreach_enrollment_processing_claimed_at_evidence',
  'outreach enrollment processing claimed_at evidence guard exists'
);

-- Parent campaign + lead fixtures for enrollment FK targets.
insert into public.outreach_campaigns (
  id, name, sender_name, sender_email, reply_to, company_postal_address,
  audience_description, value_proposition, status
) values (
  'e2000000-0000-4000-8000-000000000001',
  'Outreach Enrollment Processing Claimed-At Evidence Campaign',
  'Mise Ops',
  'ops-enrollment-processing-claimed@mise.test',
  'ops-enrollment-processing-claimed@mise.test',
  '100 Kitchen Lane, Austin, TX 78701',
  'Independent restaurants that need inventory ops',
  'Calm operating intelligence for independent restaurants',
  'draft'
);

insert into public.outreach_leads (
  id, business_name, email, source_url, contact_basis, status
) values
  (
    'e2000000-0000-4000-8000-000000000101',
    'Enrollment Processing Claimed Null Cafe',
    'enrollment-processing-claimed-null@mise.test',
    'https://example.com/enrollment-processing-claimed-null',
    'public_business_contact',
    'new'
  ),
  (
    'e2000000-0000-4000-8000-000000000102',
    'Enrollment Processing Claimed Ok Cafe',
    'enrollment-processing-claimed-ok@mise.test',
    'https://example.com/enrollment-processing-claimed-ok',
    'public_business_contact',
    'new'
  ),
  (
    'e2000000-0000-4000-8000-000000000103',
    'Enrollment Processing Claimed Queued Cafe',
    'enrollment-processing-claimed-queued@mise.test',
    'https://example.com/enrollment-processing-claimed-queued',
    'public_business_contact',
    'new'
  ),
  (
    'e2000000-0000-4000-8000-000000000104',
    'Enrollment Processing Claimed Contacted Cafe',
    'enrollment-processing-claimed-contacted@mise.test',
    'https://example.com/enrollment-processing-claimed-contacted',
    'public_business_contact',
    'new'
  ),
  (
    'e2000000-0000-4000-8000-000000000105',
    'Enrollment Processing Claimed Ready Cafe',
    'enrollment-processing-claimed-ready@mise.test',
    'https://example.com/enrollment-processing-claimed-ready',
    'public_business_contact',
    'new'
  ),
  (
    'e2000000-0000-4000-8000-000000000106',
    'Enrollment Processing Claimed Update Ok Cafe',
    'enrollment-processing-claimed-update-ok@mise.test',
    'https://example.com/enrollment-processing-claimed-update-ok',
    'public_business_contact',
    'new'
  ),
  (
    'e2000000-0000-4000-8000-000000000107',
    'Enrollment Processing Claimed Update Null Cafe',
    'enrollment-processing-claimed-update-null@mise.test',
    'https://example.com/enrollment-processing-claimed-update-null',
    'public_business_contact',
    'new'
  ),
  (
    'e2000000-0000-4000-8000-000000000108',
    'Enrollment Processing Claimed Explicit Null Cafe',
    'enrollment-processing-claimed-explicit-null@mise.test',
    'https://example.com/enrollment-processing-claimed-explicit-null',
    'public_business_contact',
    'new'
  );

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status
    ) values (
      'e2000000-0000-4000-8000-000000000201',
      'e2000000-0000-4000-8000-000000000001',
      'e2000000-0000-4000-8000-000000000101',
      'processing'
    )
  $sql$),
  'Outreach enrollment claim time is required',
  'direct outreach_enrollments insert cannot mint processing status without claimed_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status, claimed_at, claimed_from_status
    ) values (
      'e2000000-0000-4000-8000-000000000202',
      'e2000000-0000-4000-8000-000000000001',
      'e2000000-0000-4000-8000-000000000102',
      'processing',
      now(),
      'ready'
    )
  $sql$),
  null,
  'direct outreach_enrollments insert with claimed_at remains allowed for processing status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status
    ) values (
      'e2000000-0000-4000-8000-000000000203',
      'e2000000-0000-4000-8000-000000000001',
      'e2000000-0000-4000-8000-000000000103',
      'queued'
    )
  $sql$),
  null,
  'direct outreach_enrollments insert can open queued without claim time'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status
    ) values (
      'e2000000-0000-4000-8000-000000000204',
      'e2000000-0000-4000-8000-000000000001',
      'e2000000-0000-4000-8000-000000000104',
      'contacted'
    )
  $sql$),
  null,
  'direct outreach_enrollments insert can mint contacted without claimed_at under this tip'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status
    ) values (
      'e2000000-0000-4000-8000-000000000205',
      'e2000000-0000-4000-8000-000000000001',
      'e2000000-0000-4000-8000-000000000105',
      'ready'
    )
  $sql$),
  null,
  'direct outreach_enrollments insert can mint ready without claimed_at'
);

insert into public.outreach_enrollments (
  id, campaign_id, lead_id, status
) values (
  'e2000000-0000-4000-8000-000000000206',
  'e2000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000106',
  'queued'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_enrollments
    set status = 'processing',
      claimed_at = now(),
      claimed_from_status = 'queued',
      updated_at = now()
    where id = 'e2000000-0000-4000-8000-000000000206'
      and status = 'queued'
  $sql$),
  null,
  'claim UPDATE with claimed_at remains allowed (INSERT-only tip)'
);

insert into public.outreach_enrollments (
  id, campaign_id, lead_id, status
) values (
  'e2000000-0000-4000-8000-000000000207',
  'e2000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000107',
  'queued'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_enrollments
    set status = 'processing',
      claimed_from_status = 'queued',
      updated_at = now()
    where id = 'e2000000-0000-4000-8000-000000000207'
      and status = 'queued'
      and claimed_at is null
  $sql$),
  null,
  'claim UPDATE without claimed_at remains allowed (INSERT-only tip)'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_enrollments (
      id, campaign_id, lead_id, status, claimed_at
    ) values (
      'e2000000-0000-4000-8000-000000000208',
      'e2000000-0000-4000-8000-000000000001',
      'e2000000-0000-4000-8000-000000000108',
      'processing',
      null
    )
  $sql$),
  'Outreach enrollment claim time is required',
  'direct outreach_enrollments insert cannot mint processing status with explicit null claimed_at'
);

select * from finish();
rollback;
