# MISE-005ABZ: pin Today floor-notes display note.body to ASCII C

Date: 2026-11-10  
Branch: `cursor/mise-today-floor-notes-body-display-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Today floor-notes card display `note.body` inventing / blank-body bypass via
prior truthy-gated always-pass:

```tsx
{note.body ? (
  <Text numberOfLines={2} style={styles.floorNoteDetail}>
    {note.body}
  </Text>
) : null}
```

Soft-null empty / Unicode-padded / unsafe bodies → omit optional detail Text.
Alone-OK beside #1235 / #1084 / #839 / #838 / #1181 (no migration). Distinct
from write-path floor-notes body tip (#839 / MISE-005PE) and Today display
title tip (#1235 / MISE-005ABY).

## Inventing / bypass proof

- Free-form operator body → `normalizeOperatorTaskBody` Unicode-aware `\s`
  end-trim invents clean body identity
- `Boolean("\u2003") === true` previously still rendered as floorNoteDetail Text
- `"\u2003Ask prep before open\u2003".trim() === "Ask prep before open"`
  inventing equality
- ASCII C soft-null restores intentional omit

## Leave alone

- Today floor-notes display note.title (#1235 / MISE-005ABY)
- Today floor-notes row a11y note.title (#1084 / MISE-005XX)
- Floor-notes write-path body normalize (#839 / MISE-005PE)
- Floor-notes write-path title normalize (#838 / MISE-005PD)
- Create Task list display body (#1181 / MISE-005ZW)

## Alone-OK

No migration. Beside #1235 / #1084 / #839 / #838 / #1181. Ordinary UI conflict
possible with Today inventing stacks on `app/(tabs)/today.tsx`.

## Verification

- Focused `todayFloorNotesBodyDisplayAsciiC` 5/5 (71 assertion call sites; plan from source)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
