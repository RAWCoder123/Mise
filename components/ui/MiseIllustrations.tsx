import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";

import { colors } from "../../constants/theme";

const shadowFill = colors.panelStrong;
const paperFill = colors.surface;
const warmFill = colors.surfaceWarm;
const crateFill = colors.redSoft;
const outlineWidth = "2.6";

export function ProduceCrateIllustration({ size = 86 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 86">
      <Ellipse cx="48" cy="78" rx="31" ry="5" fill={shadowFill} />
      <Circle cx="39" cy="31" r="12" fill={colors.tomato} stroke={colors.text} strokeWidth={outlineWidth} />
      <Path
        d="M39 18c-4-7-1-13 4-17 3 7 1 13-4 17Z"
        fill={colors.text}
        stroke={colors.text}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Path
        d="M37 19c-7-4-9-10-8-15 7 2 11 7 8 15Z"
        fill={colors.text}
        stroke={colors.text}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Path d="M48 36c1-7 6-11 12-9 5 2 7 6 7 11H48Z" fill={warmFill} stroke={colors.text} strokeWidth={outlineWidth} />
      <Rect x="62" y="15" width="15" height="34" rx="4" fill={paperFill} stroke={colors.text} strokeWidth={outlineWidth} />
      <Rect x="64" y="7" width="11" height="10" rx="1.5" fill={paperFill} stroke={colors.text} strokeWidth={outlineWidth} />
      <Rect x="17" y="38" width="62" height="33" rx="2.5" fill={crateFill} stroke={colors.text} strokeWidth={outlineWidth} />
      <Line x1="18" y1="49" x2="78" y2="49" stroke={colors.text} strokeWidth="2.4" />
      <Line x1="18" y1="60" x2="78" y2="60" stroke={colors.text} strokeWidth="2.4" />
      <Circle cx="27" cy="44" r="1.7" fill={colors.muted} />
      <Circle cx="69" cy="44" r="1.7" fill={colors.muted} />
      <Circle cx="27" cy="55" r="1.7" fill={colors.muted} />
      <Circle cx="69" cy="55" r="1.7" fill={colors.muted} />
      <Circle cx="27" cy="66" r="1.7" fill={colors.muted} />
      <Circle cx="69" cy="66" r="1.7" fill={colors.muted} />
    </Svg>
  );
}

/** Compact checklist-and-produce artwork used by the concept's Home briefing. */
export function BriefClipboardIllustration({ size = 86 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 86">
      <Ellipse cx="50" cy="78" rx="31" ry="5" fill={shadowFill} />
      <Circle cx="49" cy="45" r="31" fill={colors.warningSoft} opacity="0.72" />
      <Rect
        x="28"
        y="12"
        width="40"
        height="58"
        rx="7"
        fill="#FFDCC4"
        stroke={colors.tomato}
        strokeWidth="2.2"
      />
      <Rect x="34" y="18" width="28" height="44" rx="2.5" fill={paperFill} />
      <Rect x="39" y="7" width="18" height="11" rx="3" fill={colors.tomato} />
      <Path
        d="M39 29l3 3 6-7"
        fill="none"
        stroke={colors.tomato}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="51" y1="29" x2="58" y2="29" stroke={colors.borderStrong} strokeWidth="2.2" strokeLinecap="round" />
      <Path
        d="M39 40l3 3 6-7"
        fill="none"
        stroke={colors.tomato}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="51" y1="40" x2="58" y2="40" stroke={colors.borderStrong} strokeWidth="2.2" strokeLinecap="round" />
      <Path
        d="M39 51l3 3 6-7"
        fill="none"
        stroke={colors.tomato}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="51" y1="51" x2="58" y2="51" stroke={colors.borderStrong} strokeWidth="2.2" strokeLinecap="round" />
      <Circle cx="68" cy="64" r="9" fill={colors.tomato} stroke={colors.text} strokeWidth="2" />
      <Path
        d="M68 54c-4-5-2-10 2-13 3 5 2 9-2 13Z"
        fill={colors.success}
        stroke={colors.text}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Path
        d="M61 68c-10 4-17 0-20-7 8-3 16-1 20 7Z"
        fill={colors.success}
        stroke={colors.text}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Circle cx="78" cy="69" r="5" fill="#F2B94B" stroke={colors.text} strokeWidth="1.8" />
    </Svg>
  );
}

export function SupplierBagIllustration({ size = 86 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 86">
      <Ellipse cx="48" cy="78" rx="29" ry="5" fill={shadowFill} />
      <Path
        d="M33 34c0-12 8-19 18-17 8 1 14 8 14 17"
        fill="none"
        stroke={colors.text}
        strokeWidth={outlineWidth}
        strokeLinecap="round"
      />
      <Rect x="25" y="33" width="46" height="36" rx="8" fill={paperFill} stroke={colors.text} strokeWidth={outlineWidth} />
      <Line x1="35" y1="49" x2="61" y2="49" stroke={colors.tomato} strokeWidth="4" strokeLinecap="round" />
      <Line x1="35" y1="58" x2="54" y2="58" stroke={colors.faint} strokeWidth="4" strokeLinecap="round" />
      <Circle cx="66" cy="22" r="10" fill={colors.tomato} />
      <Path
        d="M66 9c1-6 5-10 10-11 0 7-4 11-10 11Z"
        fill={colors.text}
        stroke={colors.text}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <Line x1="70" y1="26" x2="82" y2="34" stroke={colors.text} strokeWidth="3.8" strokeLinecap="round" />
    </Svg>
  );
}

export function InsightChartIllustration({ size = 86 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 86">
      <Ellipse cx="48" cy="78" rx="30" ry="5" fill={shadowFill} />
      <Rect x="20" y="20" width="56" height="47" rx="8" fill={paperFill} stroke={colors.text} strokeWidth={outlineWidth} />
      <Line x1="30" y1="56" x2="66" y2="56" stroke={colors.border} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1="30" y1="45" x2="66" y2="45" stroke={colors.border} strokeWidth="2.2" strokeLinecap="round" />
      <Path
        d="M29 55c8-15 16-9 23-21 6 9 11 7 16-1"
        fill="none"
        stroke={colors.tomato}
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="52" cy="34" r="5.5" fill={colors.tomato} stroke={colors.text} strokeWidth="2" />
      <Path d="M25 13c4-6 10-9 17-8" fill="none" stroke={colors.text} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

export function GmailMark({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="6" y="12" width="36" height="28" rx="5" fill="#FFFFFF" />
      <Path d="M10 15l14 12 14-12" fill="none" stroke="#EA4335" strokeWidth="6" strokeLinejoin="round" />
      <Path d="M9 18v18" stroke="#4285F4" strokeWidth="6" strokeLinecap="round" />
      <Path d="M39 18v18" stroke="#34A853" strokeWidth="6" strokeLinecap="round" />
      <Path d="M10 36h28" stroke="#FBBC05" strokeWidth="6" strokeLinecap="round" />
    </Svg>
  );
}
