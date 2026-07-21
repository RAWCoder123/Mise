-- Service-only sales outreach agent for Mise.
-- This data is intentionally separate from restaurant tenant data. The Expo client
-- receives no grants, provider credentials remain Edge Function secrets, and every
-- lead/campaign must be explicitly approved before an email can be sent.

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  company_name text not null default 'Mise' check (char_length(btrim(company_name)) between 1 and 120),
  sender_name text not null check (char_length(btrim(sender_name)) between 1 and 120),
  sender_email text not null check (sender_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  reply_to text not null check (reply_to ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  company_postal_address text not null check (char_length(btrim(company_postal_address)) between 8 and 500),
  audience_description text not null check (char_length(btrim(audience_description)) between 1 and 500),
  value_proposition text not null check (char_length(btrim(value_proposition)) between 1 and 800),
  cta_url text,
  timezone text not null default 'America/New_York' check (char_length(timezone) between 1 and 100),
  send_window_start_hour smallint not null default 9 check (send_window_start_hour between 0 and 23),
  send_window_end_hour smallint not null default 17 check (send_window_end_hour between 1 and 24),
  send_weekdays smallint[] not null default array[1,2,3,4,5]::smallint[],
  daily_send_limit smallint not null default 20 check (daily_send_limit between 1 and 50),
  max_follow_ups smallint not null default 1 check (max_follow_ups between 0 and 2),
  follow_up_delay_days smallint not null default 5 check (follow_up_delay_days between 2 and 30),
  require_message_review boolean not null default true,
  approved_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outreach_campaign_send_window_valid check (send_window_start_hour < send_window_end_hour),
  constraint outreach_campaign_weekdays_valid check (
    cardinality(send_weekdays) between 1 and 7
    and send_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  constraint outreach_campaign_activation_approved check (status <> 'active' or approved_at is not null),
  constraint outreach_campaign_cta_url check (cta_url is null or cta_url ~* '^https?://')
);

create table if not exists public.outreach_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(btrim(business_name)) between 1 and 160),
  contact_name text,
  email text not null check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  email_normalized text generated always as (lower(btrim(email))) stored,
  city text,
  state text,
  cuisine text,
  website text,
  fit_notes text,
  source_url text not null check (source_url ~* '^https?://'),
  contact_basis text not null check (contact_basis in ('public_business_contact', 'referral', 'opt_in')),
  status text not null default 'new' check (
    status in ('new', 'approved', 'contacted', 'replied', 'interested', 'not_interested', 'unsubscribed', 'bounced', 'invalid')
  ),
  verified_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_normalized),
  constraint outreach_lead_approval_verified check (status <> 'approved' or (verified_at is not null and approved_at is not null)),
  constraint outreach_lead_website_url check (website is null or website ~* '^https?://')
);

create table if not exists public.outreach_enrollments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  lead_id uuid not null references public.outreach_leads(id) on delete cascade,
  status text not null default 'queued' check (
    status in (
      'queued', 'awaiting_review', 'ready', 'processing', 'contacted', 'replied',
      'interested', 'not_interested', 'completed', 'suppressed', 'attention_required'
    )
  ),
  follow_up_count smallint not null default 0 check (follow_up_count between 0 and 2),
  next_send_at timestamptz not null default now(),
  approved_at timestamptz,
  last_sent_at timestamptz,
  claimed_at timestamptz,
  claimed_from_status text check (claimed_from_status in ('queued', 'ready', 'contacted')),
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  lead_id uuid not null references public.outreach_leads(id) on delete cascade,
  enrollment_id uuid not null references public.outreach_enrollments(id) on delete cascade,
  sequence_number smallint not null check (sequence_number between 0 and 2),
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'sending', 'sent', 'delivered', 'failed', 'send_unknown', 'bounced', 'complained', 'suppressed', 'cancelled')
  ),
  subject text not null check (char_length(btrim(subject)) between 1 and 78),
  body_text text not null check (char_length(btrim(body_text)) between 1 and 4000),
  body_html text not null check (char_length(btrim(body_html)) between 1 and 12000),
  personalization_note text not null check (char_length(btrim(personalization_note)) between 1 and 500),
  generation_provider text not null check (generation_provider in ('openai', 'deterministic_fallback')),
  model_name text,
  idempotency_key text not null default ('outreach_' || replace(gen_random_uuid()::text, '-', '')) unique,
  provider_message_id text unique,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 10),
  approved_at timestamptz,
  sent_at timestamptz,
  last_event_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id, sequence_number),
  constraint outreach_message_approval_timestamp check (status <> 'approved' or approved_at is not null)
);

create table if not exists public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  reason text not null check (reason in ('recipient_request', 'hard_bounce', 'spam_complaint', 'provider_suppression', 'manual')),
  source text not null check (source in ('unsubscribe', 'resend_webhook', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_normalized)
);

create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider_message_id text,
  message_id uuid references public.outreach_messages(id) on delete set null,
  event_type text not null check (char_length(btrim(event_type)) between 1 and 100),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_agent_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('manual', 'scheduled')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  campaigns_checked integer not null default 0 check (campaigns_checked >= 0),
  drafts_created integer not null default 0 check (drafts_created >= 0),
  messages_sent integer not null default 0 check (messages_sent >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.outreach_campaigns is
  'Mise company sales campaigns. Service-only: never expose through the restaurant Expo client.';
comment on table public.outreach_leads is
  'Traceable restaurant business contacts. A source URL and explicit approval are required before sending.';
comment on table public.outreach_suppressions is
  'Global Mise marketing suppression list. Suppressions apply across every campaign.';
comment on column public.outreach_enrollments.unsubscribe_token is
  'Opaque capability used only to opt a recipient out. It grants no read access and is not an authentication token.';

drop trigger if exists set_outreach_campaigns_updated_at on public.outreach_campaigns;
create trigger set_outreach_campaigns_updated_at
before update on public.outreach_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists set_outreach_leads_updated_at on public.outreach_leads;
create trigger set_outreach_leads_updated_at
before update on public.outreach_leads
for each row execute function public.set_updated_at();

drop trigger if exists set_outreach_enrollments_updated_at on public.outreach_enrollments;
create trigger set_outreach_enrollments_updated_at
before update on public.outreach_enrollments
for each row execute function public.set_updated_at();

drop trigger if exists set_outreach_messages_updated_at on public.outreach_messages;
create trigger set_outreach_messages_updated_at
before update on public.outreach_messages
for each row execute function public.set_updated_at();

drop trigger if exists set_outreach_suppressions_updated_at on public.outreach_suppressions;
create trigger set_outreach_suppressions_updated_at
before update on public.outreach_suppressions
for each row execute function public.set_updated_at();

alter table public.outreach_campaigns enable row level security;
alter table public.outreach_leads enable row level security;
alter table public.outreach_enrollments enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.outreach_suppressions enable row level security;
alter table public.outreach_events enable row level security;
alter table public.outreach_agent_runs enable row level security;

alter table public.outreach_campaigns force row level security;
alter table public.outreach_leads force row level security;
alter table public.outreach_enrollments force row level security;
alter table public.outreach_messages force row level security;
alter table public.outreach_suppressions force row level security;
alter table public.outreach_events force row level security;
alter table public.outreach_agent_runs force row level security;

revoke all on public.outreach_campaigns from public;
revoke all on public.outreach_leads from public;
revoke all on public.outreach_enrollments from public;
revoke all on public.outreach_messages from public;
revoke all on public.outreach_suppressions from public;
revoke all on public.outreach_events from public;
revoke all on public.outreach_agent_runs from public;

revoke all on public.outreach_campaigns from anon, authenticated;
revoke all on public.outreach_leads from anon, authenticated;
revoke all on public.outreach_enrollments from anon, authenticated;
revoke all on public.outreach_messages from anon, authenticated;
revoke all on public.outreach_suppressions from anon, authenticated;
revoke all on public.outreach_events from anon, authenticated;
revoke all on public.outreach_agent_runs from anon, authenticated;

grant select, insert, update, delete on public.outreach_campaigns to service_role;
grant select, insert, update, delete on public.outreach_leads to service_role;
grant select, insert, update, delete on public.outreach_enrollments to service_role;
grant select, insert, update, delete on public.outreach_messages to service_role;
grant select, insert, update, delete on public.outreach_suppressions to service_role;
grant select, insert, update, delete on public.outreach_events to service_role;
grant select, insert, update, delete on public.outreach_agent_runs to service_role;

create index if not exists idx_outreach_campaigns_active
on public.outreach_campaigns(status, updated_at) where status = 'active';

create index if not exists idx_outreach_enrollments_campaign_queue
on public.outreach_enrollments(campaign_id, status, next_send_at);

create index if not exists idx_outreach_enrollments_lead
on public.outreach_enrollments(lead_id);

create index if not exists idx_outreach_messages_provider
on public.outreach_messages(provider_message_id) where provider_message_id is not null;

create index if not exists idx_outreach_messages_campaign_sent
on public.outreach_messages(campaign_id, sent_at) where sent_at is not null;

create or replace function public.service_claim_outreach_enrollment(
  p_campaign_id uuid,
  p_allow_send boolean,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
begin
  -- Serialize claims so in-flight sends reserve campaign/global quota before
  -- another invocation can claim a different recipient.
  perform pg_advisory_xact_lock(2026071801);

  select
    enrollment.id as enrollment_id,
    enrollment.status as previous_status,
    enrollment.follow_up_count,
    enrollment.unsubscribe_token,
    campaign.id as campaign_id,
    campaign.name as campaign_name,
    campaign.company_name,
    campaign.sender_name,
    campaign.sender_email,
    campaign.reply_to,
    campaign.company_postal_address,
    campaign.audience_description,
    campaign.value_proposition,
    campaign.cta_url,
    campaign.timezone,
    campaign.send_window_start_hour,
    campaign.send_window_end_hour,
    campaign.send_weekdays,
    campaign.daily_send_limit,
    campaign.max_follow_ups,
    campaign.follow_up_delay_days,
    campaign.require_message_review,
    lead.id as lead_id,
    lead.business_name,
    lead.contact_name,
    lead.email,
    lead.city,
    lead.state,
    lead.cuisine,
    lead.website,
    lead.fit_notes,
    lead.source_url,
    lead.contact_basis
  into candidate
  from public.outreach_enrollments as enrollment
  join public.outreach_campaigns as campaign on campaign.id = enrollment.campaign_id
  join public.outreach_leads as lead on lead.id = enrollment.lead_id
  where campaign.id = p_campaign_id
    and campaign.status = 'active'
    and campaign.approved_at is not null
    and enrollment.approved_at is not null
    and lead.status in ('approved', 'contacted')
    and lead.approved_at is not null
    and lead.verified_at is not null
    and not exists (
      select 1 from public.outreach_suppressions as suppression
      where suppression.email_normalized = lead.email_normalized
    )
    and not exists (
      select 1
      from public.outreach_enrollments as earlier_enrollment
      join public.outreach_campaigns as earlier_campaign on earlier_campaign.id = earlier_enrollment.campaign_id
      where earlier_enrollment.lead_id = lead.id
        and earlier_enrollment.id <> enrollment.id
        and earlier_campaign.status = 'active'
        and earlier_enrollment.status in ('queued', 'awaiting_review', 'ready', 'processing', 'contacted')
        and (
          earlier_enrollment.created_at < enrollment.created_at
          or (earlier_enrollment.created_at = enrollment.created_at and earlier_enrollment.id < enrollment.id)
        )
    )
    and not exists (
      select 1
      from public.outreach_messages as recent_other_campaign_message
      where recent_other_campaign_message.lead_id = lead.id
        and recent_other_campaign_message.campaign_id <> campaign.id
        and recent_other_campaign_message.sent_at >= p_now - interval '30 days'
    )
    and (
      enrollment.status = 'queued'
      or (
        enrollment.status = 'contacted'
        and enrollment.next_send_at <= p_now
        and enrollment.follow_up_count < campaign.max_follow_ups
      )
      or (
        p_allow_send
        and enrollment.status = 'ready'
        and (
          select count(*)
          from public.outreach_messages as sent_message
          where sent_message.campaign_id = campaign.id
            and sent_message.sent_at >= (
              date_trunc('day', p_now at time zone campaign.timezone) at time zone campaign.timezone
            )
        ) + (
          select count(*)
          from public.outreach_enrollments as campaign_send_reservation
          where campaign_send_reservation.campaign_id = campaign.id
            and campaign_send_reservation.status = 'processing'
            and campaign_send_reservation.claimed_from_status = 'ready'
        ) < campaign.daily_send_limit
        and (
          select count(*)
          from public.outreach_messages as globally_sent_message
          where globally_sent_message.sent_at >= p_now - interval '24 hours'
        ) + (
          select count(*)
          from public.outreach_enrollments as global_send_reservation
          where global_send_reservation.status = 'processing'
            and global_send_reservation.claimed_from_status = 'ready'
        ) < 50
      )
    )
  order by
    case enrollment.status when 'ready' then 0 when 'contacted' then 1 else 2 end,
    enrollment.next_send_at,
    enrollment.created_at
  for update of enrollment skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.outreach_enrollments
  set status = 'processing', claimed_at = p_now, claimed_from_status = candidate.previous_status
  where id = candidate.enrollment_id;

  return jsonb_build_object(
    'enrollmentId', candidate.enrollment_id,
    'previousStatus', candidate.previous_status,
    'followUpCount', candidate.follow_up_count,
    'unsubscribeToken', candidate.unsubscribe_token,
    'campaign', jsonb_build_object(
      'id', candidate.campaign_id,
      'name', candidate.campaign_name,
      'companyName', candidate.company_name,
      'senderName', candidate.sender_name,
      'senderEmail', candidate.sender_email,
      'replyTo', candidate.reply_to,
      'companyPostalAddress', candidate.company_postal_address,
      'audienceDescription', candidate.audience_description,
      'valueProposition', candidate.value_proposition,
      'ctaUrl', candidate.cta_url,
      'timezone', candidate.timezone,
      'sendWindowStartHour', candidate.send_window_start_hour,
      'sendWindowEndHour', candidate.send_window_end_hour,
      'sendWeekdays', candidate.send_weekdays,
      'dailySendLimit', candidate.daily_send_limit,
      'maxFollowUps', candidate.max_follow_ups,
      'followUpDelayDays', candidate.follow_up_delay_days,
      'requireMessageReview', candidate.require_message_review
    ),
    'lead', jsonb_build_object(
      'id', candidate.lead_id,
      'businessName', candidate.business_name,
      'contactName', candidate.contact_name,
      'email', candidate.email,
      'city', candidate.city,
      'state', candidate.state,
      'cuisine', candidate.cuisine,
      'website', candidate.website,
      'fitNotes', candidate.fit_notes,
      'sourceUrl', candidate.source_url,
      'contactBasis', candidate.contact_basis
    )
  );
end;
$$;

create or replace function public.service_release_stale_outreach_claims(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_count integer;
begin
  update public.outreach_enrollments
  set status = claimed_from_status, claimed_at = null, claimed_from_status = null
  where status = 'processing'
    and claimed_from_status is not null
    and claimed_at < p_now - interval '30 minutes';

  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

create or replace function public.service_unsubscribe_outreach(
  p_token uuid,
  p_reason text default 'recipient_request'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_lead_id uuid;
  target_email text;
begin
  if p_reason not in ('recipient_request', 'manual') then
    raise exception 'Unsupported suppression reason';
  end if;

  select enrollment.lead_id, lead.email
  into target_lead_id, target_email
  from public.outreach_enrollments as enrollment
  join public.outreach_leads as lead on lead.id = enrollment.lead_id
  where enrollment.unsubscribe_token = p_token
  limit 1;

  if target_lead_id is null then
    return false;
  end if;

  insert into public.outreach_suppressions(email, reason, source)
  values (target_email, p_reason, case when p_reason = 'manual' then 'operator' else 'unsubscribe' end)
  on conflict (email_normalized) do update
  set reason = excluded.reason, source = excluded.source, updated_at = now();

  update public.outreach_leads
  set status = 'unsubscribed'
  where id = target_lead_id;

  update public.outreach_enrollments
  set status = 'suppressed', claimed_at = null, claimed_from_status = null
  where lead_id = target_lead_id
    and status not in ('replied', 'interested', 'not_interested', 'completed');

  update public.outreach_messages
  set status = 'cancelled', last_error = 'recipient_unsubscribed'
  where lead_id = target_lead_id
    and status in ('draft', 'approved');

  return true;
end;
$$;

revoke all on function public.service_claim_outreach_enrollment(uuid, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.service_release_stale_outreach_claims(timestamptz) from public, anon, authenticated;
revoke all on function public.service_unsubscribe_outreach(uuid, text) from public, anon, authenticated;
grant execute on function public.service_claim_outreach_enrollment(uuid, boolean, timestamptz) to service_role;
grant execute on function public.service_release_stale_outreach_claims(timestamptz) to service_role;
grant execute on function public.service_unsubscribe_outreach(uuid, text) to service_role;
