# MISE-005YP: pin Activity row event.title to ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-activity-row-title-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Activity hub row `event.title` inventing / blank-body bypass via prior always-pass:

```tsx
<Text style={styles.title}>{event.title}</Text>
```

Soft-null empty / Unicode-padded / unsafe activity titles → localized `activity.row.title.none` (EN / ES / zh-Hans). Alone-OK beside #1071 / #1041 / #1049 / #1072 (no migration). Distinct from Activity expand a11y title tip (#1071 / MISE-005XK). Explicitly left alone by #1071 ownership section (“Activity row display Text `{event.title}`”).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the title Text with no localized none fallback
- `"\u2003Order approved\u2003".trim() === "Order approved"` inventing equality
- ASCII C soft-null restores `activity.row.title.none`

## Leave alone

- Activity expand a11y event.title (#1071 / MISE-005XK)
- Activity subtitle restaurant.name (#1041)
- Home ActivityRow `event.title` display
- Activity `event.summary` display
- Create Task list-row a11y task.title (#1072)
- Home ApprovalsSection card.title (#1049)

## Alone-OK

No migration. Beside #1071 / #1041 / #1049 / #1072.

## Verification

- Focused `activityRowTitleAsciiC` 5/5 (52 assertion call sites; plan derived from source)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test` 688 total / 681 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` hung-timeout cancellations; unrelated to this tip)

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
