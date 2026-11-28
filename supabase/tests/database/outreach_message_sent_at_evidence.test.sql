create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' outreach_message_sent_at_evidence.test.sql
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
  'c0000000-0000-4000-8000-000000000001',
  'Outreach Sent-At Evidence Campaign',
  'Mise Ops',
  'ops-sent-at@mise.test',
  'ops-sent-at@mise.test',
  '100 Kitchen Lane, Austin, TX 78701',
  'Independent restaurants that need inventory ops',
  'Calm operating intelligence for independent restaurants',
  'draft'
);

insert into public.outreach_leads (
  id, business_name, email, source_url, contact_basis, status
) values
  ('c0000000-0000-4000-8000-000000000011', 'Lead One Sent At Kitchen',
   'lead-one-sent-at-evidence@mise.test', 'https://example.com/lead-one-sent-at',
   'public_business_contact', 'new'),
  ('c0000000-0000-4000-8000-000000000012', 'Lead Two Sent At Kitchen',
   'lead-two-sent-at-evidence@mise.test', 'https://example.com/lead-two-sent-at',
   'public_business_contact', 'new'),
  ('c0000000-0000-4000-8000-000000000013', 'Lead Three Sent At Kitchen',
   'lead-three-sent-at-evidence@mise.test', 'https://example.com/lead-three-sent-at',
   'public_business_contact', 'new'),
  ('c0000000-0000-4000-8000-000000000014', 'Lead Four Sent At Kitchen',
   'lead-four-sent-at-evidence@mise.test', 'https://example.com/lead-four-sent-at',
   'public_business_contact', 'new'),
  ('c0000000-0000-4000-8000-000000000015', 'Lead Five Sent At Kitchen',
   'lead-five-sent-at-evidence@mise.test', 'https://example.com/lead-five-sent-at',
   'public_business_contact', 'new'),
  ('c0000000-0000-4000-8000-000000000016', 'Lead Six Sent At Kitchen',
   'lead-six-sent-at-evidence@mise.test', 'https://example.com/lead-six-sent-at',
   'public_business_contact', 'new'),
  ('c0000000-0000-4000-8000-000000000017', 'Lead Seven Sent At Kitchen',
   'lead-seven-sent-at-evidence@mise.test', 'https://example.com/lead-seven-sent-at',
   'public_business_contact', 'new');

insert into public.outreach_enrollments (
  id, campaign_id, lead_id, status
) values
  ('c0000000-0000-4000-8000-000000000021',
   'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000011', 'queued'),
  ('c0000000-0000-4000-8000-000000000022',
   'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000012', 'queued'),
  ('c0000000-0000-4000-8000-000000000023',
   'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000013', 'queued'),
  ('c0000000-0000-4000-8000-000000000024',
   'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000014', 'queued'),
  ('c0000000-0000-4000-8000-000000000025',
   'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000015', 'queued'),
  ('c0000000-0000-4000-8000-000000000026',
   'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000016', 'queued'),
  ('c0000000-0000-4000-8000-000000000027',
   'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000017', 'queued');

select has_function(
  'private',
  'enforce_outreach_message_sent_at_evidence',
  'outreach message sent_at evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
      'c0000000-0000-4000-8000-000000000021',
      0, 'sent',
      'Hello from Mise',
      'Body text for sent_at evidence null sent case.',
      '<p>Body html for sent_at evidence null sent case.</p>',
      'Personalized for Lead One Sent At Kitchen',
      'deterministic_fallback'
    )
  $sql$),
  'Outreach message send time is required',
  'direct outreach_messages insert cannot mint sent status without sent_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider,
      sent_at
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000012',
      'c0000000-0000-4000-8000-000000000022',
      0, 'delivered',
      'Hello from Mise',
      'Body text for sent_at evidence null delivered case.',
      '<p>Body html for sent_at evidence null delivered case.</p>',
      'Personalized for Lead Two Sent At Kitchen',
      'deterministic_fallback',
      null
    )
  $sql$),
  'Outreach message send time is required',
  'direct outreach_messages insert cannot mint delivered status without sent_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider,
      provider_message_id, sent_at
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000013',
      'c0000000-0000-4000-8000-000000000023',
      0, 'sent',
      'Hello from Mise',
      'Body text for sent_at evidence stamped sent case.',
      '<p>Body html for sent_at evidence stamped sent case.</p>',
      'Personalized for Lead Three Sent At Kitchen',
      'deterministic_fallback',
      'provider-message-sent-at-evidence-sent',
      now()
    )
  $sql$),
  null,
  'direct outreach_messages insert with sent_at remains allowed for sent status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider,
      provider_message_id, sent_at
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000014',
      'c0000000-0000-4000-8000-000000000024',
      0, 'delivered',
      'Hello from Mise',
      'Body text for sent_at evidence stamped delivered case.',
      '<p>Body html for sent_at evidence stamped delivered case.</p>',
      'Personalized for Lead Four Sent At Kitchen',
      'deterministic_fallback',
      'provider-message-sent-at-evidence-delivered',
      now()
    )
  $sql$),
  null,
  'direct outreach_messages insert with sent_at remains allowed for delivered status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000015',
      'c0000000-0000-4000-8000-000000000025',
      0, 'draft',
      'Hello from Mise',
      'Body text for sent_at evidence draft case.',
      '<p>Body html for sent_at evidence draft case.</p>',
      'Personalized for Lead Five Sent At Kitchen',
      'deterministic_fallback'
    )
  $sql$),
  null,
  'direct outreach_messages insert can open draft without send time'
);

insert into public.outreach_messages (
  id, campaign_id, lead_id, enrollment_id, sequence_number, status,
  subject, body_text, body_html, personalization_note, generation_provider
) values (
  'c0000000-0000-4000-8000-000000000031',
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000016',
  'c0000000-0000-4000-8000-000000000026',
  0, 'draft',
  'Hello from Mise',
  'Body text for sent_at evidence update escape with time.',
  '<p>Body html for sent_at evidence update escape with time.</p>',
  'Personalized for Lead Six Sent At Kitchen',
  'deterministic_fallback'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_messages
    set status = 'sent',
      provider_message_id = 'provider-message-sent-at-update-with-time',
      sent_at = now(),
      updated_at = now()
    where id = 'c0000000-0000-4000-8000-000000000031'
      and status = 'draft'
  $sql$),
  null,
  'mark-sent UPDATE with sent_at remains allowed (INSERT-only tip)'
);

-- Second UPDATE escape: reuse the draft insert that was allowed above
-- (Lead Five / enrollment 025) and mark it sent without sent_at.
select is(
  pg_temp.error_of($sql$
    update public.outreach_messages
    set status = 'sent',
      provider_message_id = 'provider-message-sent-at-update-without-time',
      updated_at = now()
    where enrollment_id = 'c0000000-0000-4000-8000-000000000025'
      and status = 'draft'
  $sql$),
  null,
  'mark-sent UPDATE without sent_at remains allowed (INSERT-only tip)'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_messages (
      campaign_id, lead_id, enrollment_id, sequence_number, status,
      subject, body_text, body_html, personalization_note, generation_provider,
      last_error
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000017',
      'c0000000-0000-4000-8000-000000000027',
      0, 'failed',
      'Hello from Mise',
      'Body text for sent_at evidence failed without send time.',
      '<p>Body html for sent_at evidence failed without send time.</p>',
      'Personalized for Lead Seven Sent At Kitchen',
      'deterministic_fallback',
      'resend_http_500'
    )
  $sql$),
  null,
  'direct outreach_messages insert can mint failed status without send time'
);

select * from finish();
rollback;
