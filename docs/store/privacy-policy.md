# Mise Privacy Policy

Effective date: August 3, 2026

Mise is an invite-only mobile operations service for restaurant
organizations. This policy explains what Mise collects, why it is used, how it
is protected, and the choices available to account holders and restaurant
owners.

## Information Mise processes

### Account and access information

- Email address, display name, account identifier, restaurant membership, and
  role.
- Authentication sessions and security events needed to sign users in,
  enforce permissions, investigate abuse, and revoke access.
- Passwords are handled by Supabase Auth. Mise does not store plaintext
  passwords.

### Restaurant operational information

Mise processes information entered or imported by an authorized restaurant
team, including:

- restaurant profile, operating timezone, currency, service style, and
  branding;
- inventory items, counts, receipts, waste, stockouts, unit costs, canonical
  units, and reconciliation history;
- recipes, yields, menu mappings, suppliers, and package conversions;
- manually entered or CSV-imported sales;
- supplier recommendations, manager decisions, and draft orders;
- operational findings, evidence references, and feedback; and
- team membership and audit history.

Restaurant operational information remains scoped to the restaurant
organization that provided it. Mise uses it to deliver inventory,
reconciliation, findings, export, and manager-controlled planning workflows.

### Diagnostics and product analytics

Beta builds may use Sentry for crash diagnostics and PostHog for product
analytics when those services are configured. Mise applies a bounded allowlist
and secret-scrubbing before telemetry is sent. Telemetry may include an
internal user or restaurant identifier, app release, route, operation,
result, and technical error category. Mise does not intentionally send raw
restaurant records, passwords, provider credentials, supplier messages, or
direct contact details in telemetry.

## Beta capabilities and provider access

For the August 3, 2026 restaurant beta:

- supplier orders are drafts only; managers copy or export approved drafts and
  send them outside Mise;
- Square synchronization and webhooks are disabled;
- Gmail supplier delivery is disabled;
- live generative AI is disabled;
- billing and Stripe invoicing are disabled; and
- autonomous supplier ordering is not available.

Mise does not request Gmail or Square access for this beta. If those
integrations are introduced in a later release, this policy and the in-app
disclosures will be updated before activation.

## Storage, security, and tenant isolation

Mise uses Supabase-hosted authentication, Postgres, and server functions.
Restaurant records are protected by tenant identifiers, role checks, row-level
security, validated server boundaries, and audit evidence. Inventory and
manager-decision history is append-only; corrections create new evidence
instead of silently rewriting prior events.

Mise uses transport encryption supported by its infrastructure providers and
keeps privileged provider credentials outside the mobile application.
No security control can eliminate every risk, so suspected unauthorized
access should be reported promptly using the contact information below.

## Sharing and service providers

Mise does not sell personal information and does not use restaurant data for
third-party advertising. Information is shared only as needed with service
providers operating the product:

- Supabase for authentication, database storage, and server functions;
- Sentry for scrubbed crash diagnostics, when configured; and
- PostHog for scrubbed product analytics, when configured.

Authorized restaurant team members can access information according to their
role. A restaurant owner or administrator may export the restaurant's
operational data from the app.

## Retention, export, and deletion

- Operational information is retained while its restaurant workspace is
  active so Mise can preserve inventory history, decisions, reconciliation,
  and audit evidence.
- Owners and administrators may request a machine-readable export and can
  initiate it from Settings.
- Provider credentials, encrypted secrets, and private security logs are never included.
- Oversized exports are delivered through Mise support rather than returned partially.
- Any signed-in account holder can initiate account deletion from Settings.
- Deleting an account removes its active memberships. A restaurant workspace
  is deleted when the account is its sole remaining owner; a workspace with
  another active owner remains available to that organization.
- A durable, access-restricted deletion audit may remain to prove or recover completion of a deletion request.
- Provider backups expire under the applicable backup retention process.

For help with an export, deletion, correction, or access request, contact Mise.
Mise will verify the requester and restaurant authority before disclosing or
changing organization data.

## Choices and rights

Depending on location, an individual may have rights to request access,
correction, export, restriction, or deletion of personal information. Mise is
a United States, business-to-business beta, but applicable privacy rights are
honored. Requests receive a response within 30 days unless a different period
is required by law.

Mise does not knowingly collect information from children under 13. The
service is intended for restaurant organizations and their authorized staff.

## Changes

Mise will update this policy when data practices or enabled providers change.
The effective date above will change, and material changes will be disclosed
in the app or through the restaurant's beta contact.

## Contact

- Privacy and data requests: privacy@getmise.app
- Product and account support: support@getmise.app

These addresses must be actively monitored before the restaurant beta opens.
