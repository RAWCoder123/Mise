/**
 * Mise design tokens.
 *
 * Keep compatibility aliases here while the app moves onto the smaller,
 * semantic palette. Screen code should prefer background/surface/text/muted,
 * accent for Mise tomato, and success for fresh/positive state.
 */
export const colors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  /**
   * Warm page canvas behind white cards. `background` stays pure white for
   * card and input surfaces; `canvas` is what a screen sits on, which is what
   * AGENTS.md means by "warm neutral background".
   */
  canvas: "#FAF8F5",
  surfaceWarm: "#FAF8F5",
  panel: "#F7F7F5",
  panelStrong: "#EEEEEC",
  text: "#171715",
  muted: "#6A6965",
  faint: "#8A8984",
  border: "#E7E7E3",
  borderStrong: "#D6D1C9",
  redSoft: "#FDEBEC",
  redBase: "#F5222D",
  redDark: "#E51620",
  redCritical: "#D91019",
  redBorder: "#F5222D",
  accent: "#F5222D",
  accentDark: "#E51620",
  accentSoft: "#FDEBEC",
  tomato: "#F5222D",
  tomatoDark: "#E51620",
  tomatoSoft: "#FDEBEC",
  basil: "#357B45",
  basilDark: "#286638",
  basilSoft: "#EAF4EC",
  saffron: "#B35600",
  saffronDark: "#8F4500",
  saffronSoft: "#FFF1E5",
  berry: "#D91019",
  berryDark: "#B90D15",
  berrySoft: "#FDEBEC",
  mint: "#357B45",
  mintDark: "#286638",
  mintSoft: "#EAF4EC",
  cream: "#FAF8F5",
  charcoalSoft: "#2A2A27",
  ink: "#171715",
  inkSoft: "#2A2A27",
  inkMuted: "#6A6965",
  success: "#357B45",
  successSoft: "#EAF4EC",
  caution: "#9A6700",
  cautionSoft: "#FFF4D6",
  warning: "#B35600",
  warningSoft: "#FFF1E5",
  danger: "#D91019",
  dangerSoft: "#FDEBEC",
  black: "#171715"
} as const;

/**
 * Shared operational color meanings. Keep these mappings authoritative so a
 * stock state never changes meaning between a ring, filter, row, or detail.
 */
export const inventoryStatusColors = {
  Good: colors.success,
  Watch: colors.caution,
  Low: colors.warning,
  Critical: colors.danger
} as const;

export const inventoryStatusSoftColors = {
  Good: colors.successSoft,
  Watch: colors.cautionSoft,
  Low: colors.warningSoft,
  Critical: colors.dangerSoft
} as const;

export const radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 18
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

/** Concept uses hairline borders — keep shadow tokens inert. */
export const shadows = {
  card: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  },
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  }
} as const;

export const fontFamilies = {
  display: "Fraunces_600SemiBold",
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold"
} as const;

/**
 * Default typography — keep slightly roomier for setup/auth and dense forms.
 * Primary tab/reference surfaces should prefer `conceptTypography`.
 */
export const typography = {
  families: fontFamilies,
  screenTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3
  },
  sectionTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0
  },
  metricValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3
  },
  cardTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0
  },
  caption: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0
  },
  button: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0
  }
} as const;

/** Reference-scale type for the eight-screen concept surfaces. */
export const conceptTypography = {
  /**
   * Fraunces display voice for narrative moments only — the Home greeting,
   * empty states, and operational heroes. Chrome, section labels, and every
   * number stay Inter. Fraunces carries no CJK glyphs, so zh-Hans falls back
   * to the system sans here; keep usage short and clamped.
   */
  displayTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.4
  },
  screenTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.3
  },
  /** Fits the design:static-locked 56px app bar with trailing actions. */
  appBarTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.2
  },
  /** Home greeting. Sans by design — the concept headline is not a serif. */
  greeting: {
    fontFamily: fontFamilies.bold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.45
  },
  /** Metric numerals and order totals. */
  metricValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.45
  },
  /** Card heads that outrank a row title — supplier name, detail header. */
  cardTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: -0.25
  },
  /**
   * Section heading. Outranks rowTitle by WEIGHT at equal size: at 13px on a
   * 390pt screen, dropping to 12 would make the heading recede below the row
   * it labels.
   */
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.2
  },
  rowTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.1
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0
  },
  button: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0
  },
  /** Row sublines and alert messages — the static counterpart to `button`. */
  subtitle: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0
  },
  /**
   * The label rung: metric labels, group labels, timeline windows. Tracking
   * stays at 0 so no Spanish or Chinese string widens at 390px.
   */
  caption: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0
  },
  /** Badges, comparison lines, provenance. The smallest legible rung. */
  micro: {
    fontFamily: fontFamilies.semibold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.2
  }
} as const;

/** Shared concept density — roomy reference proportions; use hitSlop for 44px targets.
 * App bar / tab bar heights stay at the design:static-locked 56 / 62 chrome sizes.
 */
export const density = {
  appBar: 56,
  tabBar: 62,
  tabIcon: 19,
  tabLabel: 9,
  gutter: 16,
  hitTarget: 44,
  /** SectionHeader row height; the action uses hitSlop to reach 44. */
  sectionHeader: 20,
  /** SectionHeader bottom margin. */
  headerGap: 4,
  /** Between sections in a screen stack. */
  sectionGap: 14,
  timeColumn: 48,
  timelineRow: 54,
  timelineRowActive: 84,
  menuRow: 46,
  operationalRow: 48,
  healthCard: 104,
  shortcutTile: 64,
  profileRow: 56,
  identityRow: 64,
  compactButton: 32,
  iconPlain: 30,
  chevron: 14
} as const;

/**
 * One icon system, one weight, four sizes. Line icons only (lucide) — no
 * cartoon artwork, no emoji, no mixed families. Chart components draw their
 * own strokes and are deliberately out of scope here.
 */
export const icon = {
  /** Tab bar. */
  nav: 19,
  /** Emphasis: empty states, section leads. */
  emphasis: 20,
  /** The default: list rows, buttons, app-bar actions. */
  row: 18,
  /** Inline with text, badges, dense meta. */
  inline: 16
} as const;

/** The single stroke weight for every icon in the product. */
export const iconStroke = 1.9;
