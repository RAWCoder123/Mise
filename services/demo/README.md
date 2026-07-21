# Replaceable Demo Data

Mise keeps local demo content behind one stable boundary:

- `demoDataset.ts` defines the demo identity and labels used by screens and session code.
- `demoSetupData.ts` defines the replaceable starter rows and CSV example used by guided setup.
- `replaceableDemoData.ts` builds the deterministic local fixture used by the demo repository.
- `../demoData.ts` is the stable compatibility export consumed by the rest of the app.

To replace the sample restaurant, edit only the files in this directory. Keep the exported
`DemoState` contract and deterministic IDs intact so local persistence repair, interaction QA, and
domain tests continue to work. Product screens, domain services, and Supabase-backed repositories
must not contain restaurant-specific demo names or fixture rows.
