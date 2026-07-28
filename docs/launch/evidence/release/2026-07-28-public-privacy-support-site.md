# Public privacy and support site evidence

Verified: 2026-07-28T23:38:08Z

## Delivered

The existing Mise marketing-site project now contains:

- `/privacy`, rendered from the reviewed August 3 beta policy;
- `/support`, with safe incident-reporting guidance and beta limitations;
- visible privacy and support links in the marketing footer;
- responsive legal-page styling using the Mise tomato, basil, white, ink, and
  warm-neutral visual system; and
- server-render coverage for both routes, titles, contacts, safety warnings,
  and cross-navigation.

Site source checkpoint:
`e38d0c2a1c857c0e66aed5bf96eaea035cfb0504`

The exact source was pushed to the existing Sites repository, packaged from its
validated build, saved as site version 9, and deployed successfully to the
existing owner-only production URL:
`https://mise-restaurant-ops.raymondaw2006.chatgpt.site`.

No application, tenant, database, provider, or production credential is
present in the site.

## Verification

- `cd site && npm test`: production build passed; `/`, `/privacy`, and
  `/support` server-render tests passed.
- `cd site && npm run lint`: zero errors. Eight warnings came only from
  pre-existing untracked duplicate files and were not included in the
  checkpoint.
- Sites deployment `appgdep_6a693d56a2ec8191952a3718ef8d3e8b` succeeded for
  saved version 9.
- Unauthenticated HTTP checks return 401 for the owner-only Sites routes.
- `https://getmise.app/privacy` and `https://getmise.app/support` timed out
  without returning HTTP content.

## External restriction

The attempt to change the existing Sites project from owner-only to public was
rejected with `sites_publish_disabled`: public internet publishing is not
enabled for the workspace. No access policy was changed.

Therefore this is a deployable, reviewed site checkpoint, but it does not
satisfy the release check for publicly reachable privacy and support pages.
The gate remains pending until one of these controlled paths is completed:

1. enable public Sites publishing for the workspace and publish the existing
   version; or
2. connect the reviewed site source to the owner-controlled `getmise.app`
   hosting environment and verify both routes over unauthenticated HTTPS.

Separately, `support@getmise.app` and `privacy@getmise.app` must be actively
monitored by named beta responders before restaurant admission.
