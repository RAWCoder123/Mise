# Mise Privacy Policy

Effective date: September 14, 2026 (draft — requires legal review before publication)

Publish this document at a public URL (for example `https://getmise.app/privacy`) before App Store submission. Apple and Google both require a working privacy policy URL.

## Who we are

Mise ("Mise", "we", "us") is a mobile operations system for independent restaurants. This policy explains what information we collect when you use the Mise app, why we collect it, and the choices you have.

## Information we collect

### Account information

- Email address and password (passwords are handled by our authentication provider, Supabase Auth; we never store plaintext passwords).
- Your name and role, if you provide them.

### Restaurant operational data

Data you or your team enter to run your restaurant:

- Restaurant profile: name, address, timezone, currency, service style, branding.
- Inventory items, unit costs, par levels, and counts.
- Recipes and menu item ingredients.
- Sales records you enter manually or import from CSV files.
- Supplier names, contact emails, and purchase orders.
- Team membership: which accounts belong to your restaurant workspace and their roles.

This data belongs to your restaurant. We use it only to provide the product's features (inventory tracking, order recommendations, insights).

### Supplier email delivery

When you send a purchase order to a supplier through Mise, we transmit the order email through our email delivery provider. If you later connect a Gmail account for sending, Google OAuth refresh tokens are stored encrypted server-side and are never available to the app on your device. We only request the minimum Gmail permission required to send email on your behalf, and we never read your inbox.

### Diagnostics and analytics

If enabled in the build, we collect crash reports (via Sentry) and product usage events (via PostHog) to keep the app reliable and improve it. These are scrubbed of secrets before transmission. We do not sell this data or use it for advertising.

## What we do NOT collect

- We do not collect precise location.
- We do not access your contacts, photos, or messages.
- We do not sell personal data to third parties.
- We do not use your data for third-party advertising.

## How your data is stored

Data is stored with Supabase (hosted Postgres) with row-level security so each restaurant workspace can only be accessed by its own members. Backups and encryption in transit (TLS) and at rest are provided by our infrastructure providers.

## Data sharing

We share data only with the service providers required to operate Mise: Supabase (database, authentication, serverless functions), our email delivery provider (supplier order emails), and, if enabled, Sentry (crash reporting) and PostHog (analytics). Each provider processes data only on our instructions.

## Data retention and deletion

- Restaurant operational data is retained while the restaurant workspace is
  active so Mise can preserve inventory history, decisions, reconciliation, and
  audit evidence.
- You can delete your account at any time from Settings → Account → Delete account. This removes your account, your memberships, and any restaurant workspaces where you are the sole owner.
- Restaurants with other remaining owners are not deleted when one member leaves.
- Deleting a sole-owner restaurant removes its primary-database operational
  records. A durable, access-restricted deletion audit may remain so Mise can
  prove completion or recover a failed cleanup.
- Backups expire on our infrastructure providers' standard schedules.

## Your rights

Depending on your jurisdiction (for example GDPR or CCPA), you may have rights to access, correct, export, or delete your personal data. Restaurant owners and administrators may request a machine-readable export of the restaurant profile, team directory, operational mappings, sales, inventory history, supplier drafts, findings, and audit history. Provider credentials, encrypted secrets, and private security logs are never included in that export. Oversized exports are delivered through Mise support rather than returned partially. Contact us at the address below and we will respond within 30 days.

## Children

Mise is a business tool and is not directed at children under 13. We do not knowingly collect data from children.

## Changes

We will update this policy as the product evolves and note the effective date above. Material changes will be announced in the app.

## Contact

- Email: privacy@getmise.app (placeholder — replace with a monitored address before publication)
