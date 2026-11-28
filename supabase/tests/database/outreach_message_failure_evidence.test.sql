create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' outreach_message_failure_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(9);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

insert into public.outreach_campaigns (
  id, name, sender_name, sender_email, reply_to, company_postal_address,
  audience_description, value_proposition, status
) values (
  'b0000000-0000-4000-8000-000000000001',
  'Outreach Failure Evidence Campaign',
  'Mise Ops',
  'ops@mise.test',
  'ops@mise.test',
  '100 Kitchen Lane, Austin, TX 78701',
  'Independent restaurants that need inventory ops',
  'Calm operating intelligence for independent restaurants',
  'draft'
);

insert into public.outreach_leads (
  id, business_name, email, source_url, contact_basis, status
) values
  ('b0000000-0000-4000-8000-000000000011', 'Lead One Kitchen',
   'lead-one-failure-evidence@mise.test', 'https://example.com/lead-one',
   'public_business_contact', 'new'),
  ('b0000000-0000-4000-8000-000000000012', 'Lead Two Kitchen',
   'lead-two-failure-evidence@mise.test', 'https://example.com/lead-two',
   'public_business_contact', 'new'),
  ('b0000000-0000-4000-8000-000000000013', 'Lead Three Kitchen',
   'lead-three-failure-evidence@mise.test', 'https://example.com/lead-three',
   'public_business_contact', 'new'),
  ('b0000000-0000-4000-8000-000000000014', 'Lead Four Kitchen',
   'lead-four-failure-evidence@mise.test', 'https://example.com/lead-four',
   'public_business_contact', 'new'),
  ('b0000000-0000-4000-8000-000000000015', 'Lead Five Kitchen',
   'lead-five-failure-evidence@mise.test', 'https://example.com/lead-five',
   'public_business_contact', 'new'),
  ('b0000000-0000-4000-8000-000000000016', 'Lead Six Kitchen',
   'lead-six-failure-evidence@mise.test', 'https://example.com/lead-six',
   'public_business_contact', 'new'),
  ('b0000000-0000-4000-8000-000000000017', 'Lead Seven Kitchen',
   'lead-seven-failure-evidence@mise.test', 'https://example.com/lead-seven',
   'public_business_contact', 'new');

insert into public.outreach_enrollments (
  id, campaign_id, lead_id, status
) values
  ('b0000000-0000-4000-8000-000000000021',
   'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000011', 'queued'),
  ('b0000000-0000-4000-8000-000000000022',
   'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000012', 'queued'),
  ('b0000000-0000-4000-8000-000000000023',
   'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000013', 'queued'),
  ('b0000000-0000-4000-8000-000000000024',
   'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000014', 'queued'),
  ('b0000000-0000-4000-8000-000000000025',
   'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000015', 'queued'),
  ('b0000000-0000-4000-8000-000000000026',
   'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000016', 'queued'),
  ('b0000000-0000-4000-8000-000000000027',
   'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000017', 'queued');

select has_function(
  'private',
  'enforce_outreach_message_failure_evidence',
  'outreach message failure evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider
    ) values (
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000011',
      'b0000000-0000-4000-8000-000000000021',
      0, 'failed',
      'Hello from Mise',
      'Body text for failure evidence null case.',
      '<p>Body html for failure evidence null case.</p>',
      'Personalized for Lead One Kitchen',
      'deterministic_fallback'
    )
  $sql$),
  'Outreach message failure evidence is required',
  'direct outreach_messages insert cannot mint failed status without last_error'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider,
      last_error
    ) values (
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000012',
      'b0000000-0000-4000-8000-000000000022',
      0, 'send_unknown',
      'Hello from Mise',
      'Body text for failure evidence blank case.',
      '<p>Body html for failure evidence blank case.</p>',
      'Personalized for Lead Two Kitchen',
      'deterministic_fallback',
      '   '
    )
  $sql$),
  'Outreach message failure evidence is required',
  'direct outreach_messages insert cannot mint send_unknown status with blank last_error'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider,
      last_error
    ) values (
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000013',
      'b0000000-0000-4000-8000-000000000023',
      0, 'failed',
      'Hello from Mise',
      'Body text for failure evidence stamped failed case.',
      '<p>Body html for failure evidence stamped failed case.</p>',
      'Personalized for Lead Three Kitchen',
      'deterministic_fallback',
      'resend_http_500'
    )
  $sql$),
  null,
  'direct outreach_messages insert with last_error remains allowed for failed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider,
      last_error
    ) values (
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000014',
      'b0000000-0000-4000-8000-000000000024',
      0, 'send_unknown',
      'Hello from Mise',
      'Body text for failure evidence stamped unknown case.',
      '<p>Body html for failure evidence stamped unknown case.</p>',
      'Personalized for Lead Four Kitchen',
      'deterministic_fallback',
      'provider_response_unknown'
    )
  $sql$),
  null,
  'direct outreach_messages insert with last_error remains allowed for send_unknown status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider
    ) values (
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000015',
      'b0000000-0000-4000-8000-000000000025',
      0, 'draft',
      'Hello from Mise',
      'Body text for failure evidence draft case.',
      '<p>Body html for failure evidence draft case.</p>',
      'Personalized for Lead Five Kitchen',
      'deterministic_fallback'
    )
  $sql$),
  null,
  'direct outreach_messages insert can open draft without failure evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider,
      provider_message_id, sent_at
    ) values (
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000016',
      'b0000000-0000-4000-8000-000000000026',
      0, 'sent',
      'Hello from Mise',
      'Body text for failure evidence sent case.',
      '<p>Body html for failure evidence sent case.</p>',
      'Personalized for Lead Six Kitchen',
      'deterministic_fallback',
      'provider-message-sent-evidence',
      now()
    )
  $sql$),
  null,
  'direct outreach_messages insert can mint sent status without failure evidence'
);

insert into public.outreach_messages (
  id, campaign_id, lead_id, enrollment_id, sequence_number, status,
  subject, body_text, body_html, personalization_note, generation_provider
) values (
  'b0000000-0000-4000-8000-000000000031',
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000017',
  'b0000000-0000-4000-8000-000000000027',
  0, 'draft',
  'Hello from Mise',
  'Body text for failure evidence update escape.',
  '<p>Body html for failure evidence update escape.</p>',
  'Personalized for Lead Seven Kitchen',
  'deterministic_fallback'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_messages
    set status = 'failed',
      last_error = 'resend_http_502',
      updated_at = now()
    where id = 'b0000000-0000-4000-8000-000000000031'
      and status = 'draft'
  $sql$),
  null,
  'failure UPDATE with evidence remains allowed (INSERT-only tip)'
);

-- Second UPDATE escape: reuse the draft insert that was allowed above
-- (Lead Five / enrollment 025) and fail it without last_error.
select is(
  pg_temp.error_of($sql$
    update public.outreach_messages
    set status = 'failed',
      updated_at = now()
    where enrollment_id = 'b0000000-0000-4000-8000-000000000025'
      and status = 'draft'
  $sql$),
  null,
  'failure UPDATE without last_error remains allowed (INSERT-only tip)'
);

select * from finish();
rollback;
