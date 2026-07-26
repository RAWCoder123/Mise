# App Store / Play Store Listing Content

Draft listing content for App Store Connect and Google Play Console. Finalize alongside screenshots from the TestFlight build.

## Identity

- App name: **Mise — Restaurant Operations**
- Subtitle (iOS, 30 chars max): `Inventory, orders, insights`
- Category: Business (secondary: Food & Drink)
- Age rating: 4+ (no objectionable content)
- Bundle ID / package: `com.mise.mobile`

## Promotional text (170 chars)

Run your restaurant from your pocket. Mise tracks inventory, learns your ordering patterns, drafts supplier orders, and tells you what needs attention today.

## Description

Mise is the operations system for independent restaurants.

Every shift, Mise turns your inventory and sales into a clear plan:

- TODAY — A shift timeline that tells you what needs doing now, next, and later.
- INVENTORY — Live stock health, low-stock alerts, and fast counting built for a working kitchen.
- ORDERS — Purchase recommendations that learn from what you actually approve. Review, adjust, and email supplier orders in two taps.
- INSIGHTS — Signals that matter for your restaurant's service style: usage trends, stock risk, and spend by supplier.
- TEAM — Bring in managers and staff with role-based access.

Mise learns your restaurant. The more you count, sell, and order, the sharper its recommendations get — no spreadsheets, no guesswork.

Built for independents: no POS required to start. Enter sales manually or import a CSV, and connect integrations as you grow.

## Keywords (iOS, 100 chars)

`restaurant,inventory,food cost,ordering,supplier,kitchen,purchase order,stock,chef,operations`

## Support and legal URLs (required)

- Support URL: `https://getmise.app/support` (must exist before submission; a simple contact page is sufficient)
- Privacy policy URL: `https://getmise.app/privacy` (publish docs/store/privacy-policy.md)

## App Privacy questionnaire (Apple) — answers matching the codebase

Data collected and linked to identity:

- Contact info: email address (account creation)
- User content: restaurant operational data (inventory, sales, orders, suppliers)
- Identifiers: user ID (Supabase Auth UID)
- Diagnostics: crash data (Sentry, if DSN configured)
- Usage data: product interaction events (PostHog, if key configured)

Not collected: location, contacts, photos, browsing history, purchases, health, financial info (order totals are user content, not financial account data), tracking across apps (answer NO to tracking; no ATT prompt needed).

## Review notes (App Store reviewer)

Mise requires a restaurant workspace. For review, use the demo credentials below — the demo build ships with a fully seeded example restaurant so every feature is explorable without real data:

- Demo access: tap "Explore the demo" on the login screen (no credentials needed) — available when the review build has demo mode enabled, OR
- Reviewer account: create via in-app sign-up; a fresh account walks through restaurant setup.

Account deletion is at Settings → Account → Delete account.

## Screenshot plan (6.7" iPhone required set)

1. Home command center — "Your restaurant at a glance"
2. Today timeline — "Know every shift's priorities"
3. Inventory health — "Catch stock risk before service"
4. Order review with supplier email — "Approve and send orders in two taps"
5. Insights trends — "Signals that match your service style"
6. Setup flow — "Running in an afternoon, no POS needed"

Capture at 1290x2796 from an iPhone 15 Pro Max simulator with demo data. Reuse the same frames at 1242x2688 if older sizes are requested. Android: capture the same six on a Pixel 8 Pro emulator.
