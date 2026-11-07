# MISE-005YX: pin Daily Phase Brief FindingRow finding.title display to ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-daily-phase-brief-finding-title-display-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Daily Phase Brief FindingRow display inventing / blank-body bypass via prior always-pass:

```tsx
<Text style={styles.findingTitle}>{finding.title}</Text>
```

Soft-null empty / Unicode-padded / unsafe titles → localized `dailyPhaseBrief.findingTitle.none` (EN / ES / zh-Hans). Alone-OK beside #1076 / #1085 / #1145 / #1075 / #1074 / #1146 (no migration). Distinct from finding-row a11y `finding.title` (#1076 / MISE-005XP) and Daily Brief Board `finding.title` display (#1145 / MISE-005YM).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the findingTitle Text with no localized none fallback
- `"\u2003Verify produce count\u2003".trim() === "Verify produce count"` inventing equality
- ASCII C soft-null restores `dailyPhaseBrief.findingTitle.none`

## Leave alone

- Daily Phase Brief finding-row a11y finding.title (#1076 / MISE-005XP)
- Daily Phase Brief finding-row a11y finding.interpretation (#1085 / MISE-005XY)
- Daily Phase Brief finding.interpretation display Text
- Daily Brief Board finding.title display (#1145 / MISE-005YM)
- Daily Brief card header a11y finding.title (#1075 / MISE-005XO)
- Daily Brief action a11y finding.title (#1074 / MISE-005XN)
- Daily Brief Board compact-preview firstFinding.title (#1146 / MISE-005YN)

## Alone-OK

No migration. Beside #1076 / #1085 / #1145 / #1075 / #1074 / #1146. Ordinary UI conflicts possible with Phase Brief a11y inventing stacks that also touch `app/more/daily-brief.tsx`.

## Verification

- Focused `dailyPhaseBriefFindingTitleDisplayAsciiC` 5/5 (63 assertion call sites; plan from source)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
