# App Store Readiness Checklist

Last updated: July 30, 2026

Classification guidance uses evidence, not polish. Current overall status: **not yet beta-ready for paid public launch**; **controlled pilot-ready** only after the latest migration chain passes Docker/hosted security gates.

| Item | Status | Notes |
| --- | --- | --- |
| Bundle ID `com.mise.mobile` | complete | Configured in `app.json` |
| App icon / splash | complete | Assets present; validated by `qa:ios-prereq` when Xcode is available |
| Version / build number | complete | `0.1.0` / iOS build `2` |
| Encryption export compliance flag | complete | `ITSAppUsesNonExemptEncryption = false` |
| In-app account deletion | tested (code) | Settings → Delete account; Edge `request-account-deletion` + RPC disable memberships and Auth delete |
| Privacy policy URL | requires founder decision | Wire `EXPO_PUBLIC_PRIVACY_POLICY_URL` (HTTPS) once legal copy is published |
| Support URL | requires founder decision | Wire `EXPO_PUBLIC_SUPPORT_URL` (HTTPS) once support page exists |
| Apple privacy questionnaire | requires Apple Developer account action | App Store Connect |
| Terms of service link | requires legal copy | Not yet published |
| Demo / review instructions | complete | Local demo path documented in `docs/private-beta-demo-readiness.md` |
| No debug menus in production | complete | Diagnostics gated behind `__DEV__` |
| No embedded test credentials in production | complete | Demo credentials hidden when `EXPO_PUBLIC_APP_ENV=production` |
| Tenant isolation / RLS | blocked | Latest migration chain must re-pass Docker pgTAP + hosted staging |
| Live POS provider | blocked | Fail-closed until provider credentials and server adapter exist |
| Manual CSV POS ingest | tested (code) | Bounded Settings/setup CSV path; live providers remain fail-closed |
| Live Gmail send | requires external credentials | Implemented; keep `GMAIL_SEND_ENABLED=false` until approved test |
| Real-device iPhone QA | requires Apple Developer account action | Needs physical device / TestFlight |
| Crash reporting | requires founder decision | Optional public Sentry DSN |
| Product analytics | requires founder decision | Optional public PostHog key/host |
| EAS / TestFlight upload | requires Apple Developer account action | See `docs/testflight-readiness.md` |

## Evidence still required before raising classification

1. `npm run verify:private-beta-security` with Docker and staging credentials, no skips.
2. Published privacy and support URLs configured in EAS secrets.
3. TestFlight install on a physical iPhone for core demo and hosted pilot workflows.
4. Founder decision on first live POS provider and Gmail enablement.
