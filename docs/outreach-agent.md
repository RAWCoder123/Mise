# Mise Outreach Agent

The outreach agent is a server-side Mise sales workflow for contacting independent restaurants. It is deliberately separate from restaurant tenant data and from the supplier Gmail scaffold.

The safe default flow is:

1. Create a campaign in `draft` state.
2. Import restaurant business contacts with a traceable source URL.
3. Explicitly approve the leads. Approval confirms the address and source were reviewed.
4. Explicitly activate the campaign with the exact confirmation phrase.
5. Run the agent to generate drafts.
6. Review and approve each draft. `requireMessageReview` defaults to `true`.
7. Run the agent on a schedule. It sends only during the campaign's local weekday/hour window and within its daily limit.
8. Resend webhooks record delivery state and suppress bounces, complaints, and provider suppressions. Unsubscribe requests apply across every campaign. Inbound Resend reply events stop follow-ups.

Do not import scraped personal addresses, guessed addresses, or purchased lists. The importer accepts only `public_business_contact`, `referral`, or `opt_in` as the recorded contact basis and requires a source URL. This implementation provides technical safeguards, not legal advice. Before launch, confirm the campaign, ad disclosure, postal address, opt-out flow, audience, and sending practices with counsel for every jurisdiction in scope. The FTC's CAN-SPAM guide notes that B2B commercial email is covered and requires accurate headers/subjects, an ad disclosure, a valid postal address, and a working opt-out mechanism: <https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business>.

## Components

- `supabase/migrations/20260718010000_outreach_agent.sql`: service-only campaigns, leads, enrollments, messages, suppressions, provider events, run logs, and atomic queue claiming.
- `supabase/functions/outreach-agent`: authenticated campaign management, structured drafting, review queue, bounded sending, and run status.
- `supabase/functions/outreach-webhook`: signed Resend delivery/inbound-event handling.
- `supabase/functions/outreach-unsubscribe`: GET confirmation page plus POST one-click suppression.
- `services/ai/outreachDraft.ts`: structured draft contract.
- `services/domain/outreach.ts`: pure lead validation, fallback drafting, compliance rendering, send-window logic, and provider suppression mapping.

The Expo app has no table grants or provider credentials for this workflow. The Edge Function service role is the only data path.

## Deploy and configure

Apply migrations, then deploy the functions:

```bash
supabase db push
supabase functions deploy outreach-agent
supabase functions deploy outreach-webhook
supabase functions deploy outreach-unsubscribe
```

Create strong independent values for the agent and Resend webhook secrets, then configure Edge Function secrets:

```bash
supabase secrets set MISE_OUTREACH_AGENT_SECRET=replace-with-a-long-random-value
supabase secrets set RESEND_API_KEY=replace-with-resend-api-key
supabase secrets set RESEND_WEBHOOK_SECRET=replace-with-resend-signing-secret
supabase secrets set OPENAI_API_KEY=replace-with-openai-api-key
supabase secrets set OPENAI_OUTREACH_MODEL=gpt-5.6
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by hosted Supabase. Never prefix any server secret with `EXPO_PUBLIC_`.

`OPENAI_API_KEY` is optional. Without it, the agent creates a conservative deterministic draft using only the supplied business name, city, and campaign value proposition. `RESEND_API_KEY` is required for live sending; if it is absent, approved messages remain in `ready` state.

Verify the Resend sending domain and use a sender address on that domain. Register this webhook URL in Resend:

```text
https://PROJECT_REF.supabase.co/functions/v1/outreach-webhook
```

Subscribe to at least `email.sent`, `email.delivered`, `email.failed`, `email.bounced`, `email.complained`, `email.suppressed`, and—if the reply-to inbox is hosted through Resend inbound—`email.received`. Copy that endpoint's signing secret into `RESEND_WEBHOOK_SECRET`. The webhook verifies the raw body and Svix signature before changing any data.

## Operate a campaign

Set shell variables locally so secrets do not appear in command history repeatedly:

```bash
export MISE_OUTREACH_URL="https://PROJECT_REF.supabase.co/functions/v1/outreach-agent"
export MISE_OUTREACH_SECRET="replace-with-agent-secret"
```

Create a campaign. The postal address must be a valid business postal address. Keep review enabled for the first campaigns:

```bash
curl -fsS "$MISE_OUTREACH_URL" \
  -H "content-type: application/json" \
  -H "x-mise-agent-secret: $MISE_OUTREACH_SECRET" \
  --data-binary '{
    "action": "create_campaign",
    "campaign": {
      "name": "Newark independent restaurants",
      "senderName": "Mise",
      "senderEmail": "hello@your-verified-mise-domain.example",
      "replyTo": "founder@your-mise-domain.example",
      "companyPostalAddress": "YOUR VALID BUSINESS POSTAL ADDRESS",
      "audienceDescription": "Independent restaurants in Newark with small operating teams",
      "valueProposition": "Mise turns daily inventory, prep, and ordering signals into one compact mobile workflow.",
      "ctaUrl": "https://your-mise-domain.example/demo",
      "timezone": "America/New_York",
      "sendWindowStartHour": 9,
      "sendWindowEndHour": 16,
      "sendWeekdays": [1, 2, 3, 4, 5],
      "dailySendLimit": 10,
      "maxFollowUps": 1,
      "followUpDelayDays": 5,
      "requireMessageReview": true
    }
  }'
```

Save the returned campaign ID. Import leads in batches of at most 100. A lead is not eligible to send yet:

```bash
curl -fsS "$MISE_OUTREACH_URL" \
  -H "content-type: application/json" \
  -H "x-mise-agent-secret: $MISE_OUTREACH_SECRET" \
  --data-binary '{
    "action": "import_leads",
    "campaignId": "CAMPAIGN_UUID",
    "leads": [
      {
        "businessName": "Example Restaurant",
        "email": "public-business-contact@example.test",
        "sourceUrl": "https://example.test/contact",
        "contactBasis": "public_business_contact",
        "city": "Newark",
        "state": "NJ",
        "cuisine": "Cafe",
        "website": "https://example.test",
        "fitNotes": "Small independent operator; no unsupported claims added."
      }
    ]
  }'
```

Review the source and returned lead IDs, then approve only verified business contacts:

```bash
curl -fsS "$MISE_OUTREACH_URL" \
  -H "content-type: application/json" \
  -H "x-mise-agent-secret: $MISE_OUTREACH_SECRET" \
  --data-binary '{"action":"approve_leads","campaignId":"CAMPAIGN_UUID","leadIds":["LEAD_UUID"]}'
```

Activate the campaign. This is the separate send-authority checkpoint:

```bash
curl -fsS "$MISE_OUTREACH_URL" \
  -H "content-type: application/json" \
  -H "x-mise-agent-secret: $MISE_OUTREACH_SECRET" \
  --data-binary '{"action":"activate_campaign","campaignId":"CAMPAIGN_UUID","confirmation":"I APPROVE THIS CAMPAIGN"}'
```

Generate drafts without bypassing review:

```bash
curl -fsS "$MISE_OUTREACH_URL" \
  -H "content-type: application/json" \
  -H "x-mise-agent-secret: $MISE_OUTREACH_SECRET" \
  --data-binary '{"action":"run","campaignIds":["CAMPAIGN_UUID"],"maxOperations":10,"triggerType":"manual"}'
```

List drafts, inspect the recipient, source, subject, body, and personalization note, then approve selected message IDs:

```bash
curl -fsS "$MISE_OUTREACH_URL" \
  -H "content-type: application/json" \
  -H "x-mise-agent-secret: $MISE_OUTREACH_SECRET" \
  --data-binary '{"action":"list_messages","campaignId":"CAMPAIGN_UUID","status":"draft"}'

curl -fsS "$MISE_OUTREACH_URL" \
  -H "content-type: application/json" \
  -H "x-mise-agent-secret: $MISE_OUTREACH_SECRET" \
  --data-binary '{"action":"approve_messages","campaignId":"CAMPAIGN_UUID","messageIds":["MESSAGE_UUID"]}'
```

The next `run` sends approved messages only if the campaign is active, the lead is still eligible, the address is not suppressed, the local send window is open, and the daily cap is available. The database also enforces a 50-message rolling 24-hour global cap, gives only the earliest active campaign access to a duplicated recipient, and applies a 30-day cooldown before another campaign may email that address. Resend receives an idempotency key plus `List-Unsubscribe` and one-click headers.

Pause immediately if needed:

```bash
curl -fsS "$MISE_OUTREACH_URL" \
  -H "content-type: application/json" \
  -H "x-mise-agent-secret: $MISE_OUTREACH_SECRET" \
  --data-binary '{"action":"pause_campaign","campaignId":"CAMPAIGN_UUID"}'
```

If replies land outside Resend inbound, record them before the next scheduled run to cancel follow-ups:

```bash
curl -fsS "$MISE_OUTREACH_URL" \
  -H "content-type: application/json" \
  -H "x-mise-agent-secret: $MISE_OUTREACH_SECRET" \
  --data-binary '{"action":"record_reply","campaignId":"CAMPAIGN_UUID","leadId":"LEAD_UUID","outcome":"interested"}'
```

Use `outcome` values `replied`, `interested`, or `not_interested`.

## Schedule

After a test campaign has delivered correctly and unsubscribe/webhook behavior is verified, schedule the `run` action every 15 minutes. Supabase Cron can invoke Edge Functions with `pg_cron` and `pg_net`; store both the project URL and agent secret in Supabase Vault rather than in SQL source:

```sql
select vault.create_secret('https://PROJECT_REF.supabase.co', 'mise_project_url');
select vault.create_secret('YOUR_LONG_AGENT_SECRET', 'mise_outreach_agent_secret');

select cron.schedule(
  'mise-outreach-agent-every-15-minutes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'mise_project_url') || '/functions/v1/outreach-agent',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-mise-agent-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mise_outreach_agent_secret')
    ),
    body := '{"action":"run","maxOperations":10,"triggerType":"scheduled"}'::jsonb
  );
  $$
);
```

The job can wake every 15 minutes because the agent itself enforces each campaign's local send window and daily cap. Monitor `outreach_agent_runs`, Resend domain reputation, bounce/complaint rates, replies, and suppression events. Begin with a very low daily cap and test addresses owned by Mise.

## Verification checklist

- Run `npm run typecheck` and `npm test`.
- Apply the migration in a disposable/local Supabase project.
- Confirm `anon` and `authenticated` cannot read any `outreach_*` table.
- Use a Resend-owned test recipient before any real contact.
- Confirm a generated message stays in `draft` until approved.
- Confirm an active campaign does not send outside its configured local window.
- Confirm the same message cannot be duplicated on repeated runs.
- Confirm GET on the unsubscribe URL only shows a confirmation page; POST suppresses the address globally.
- Replay a signed bounce/complaint webhook and confirm all campaign enrollments for that address become suppressed.
- Verify replies stop future follow-ups, automatically through Resend inbound or immediately through `record_reply`.
- Confirm the final rendered message contains accurate sender details, commercial disclosure, a valid physical postal address, and a working unsubscribe link.
