# MISE-005YV: pin Restaurant Memory evidence entry.summary to ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-restaurant-memory-evidence-summary-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Restaurant Memory evidence-line `entry.summary` inventing / blank-body bypass via prior always-pass:

```tsx
<Text style={styles.evidenceLine}>
  {entry.summary}
  {" · "}
  {formatDate(entry.observedAt, { dateStyle: "medium" })}
</Text>
```

Soft-null empty / Unicode-padded / unsafe summaries → localized `memory.evidence.summary.none` (EN / ES / zh-Hans). Alone-OK beside #830 / #848 / #841 / #1042 / #1150 (no migration). Distinct from Activity expanded `evidence.summary` (next inventing candidate) and restaurant-memory statement domain tip (#830 / MISE-005OV).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the evidence Text with no localized none fallback
- `"\u2003Matched 3 similar delivery delays\u2003".trim() === "Matched 3 similar delivery delays"` inventing equality
- ASCII C soft-null restores `memory.evidence.summary.none`

## Leave alone

- restaurant-memory statement free-text (#830 / MISE-005OV)
- restaurant-memory correction draft (#848 / MISE-005PN)
- restaurant-memory scope/source (#841 / MISE-005PG)
- Memory subtitle restaurant.name (#1042 / MISE-005WH)
- Activity expanded evidence.summary display (next inventing candidate)
- Activity hub row event.summary (#1150 / MISE-005YR)

## Alone-OK

No migration. Beside #830 / #848 / #841 / #1042 / #1150. Ordinary UI conflicts possible with Restaurant Memory inventing stacks.

## Verification

- Focused `restaurantMemoryEvidenceSummaryAsciiC` 5/5 (56 assertion call sites; plan from source)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
