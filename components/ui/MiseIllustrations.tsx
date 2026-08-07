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

/* ---------------------------------------------------------------------------
 * Item glyphs.
 *
 * A compact companion set to the narrative illustrations above. Those are
 * 96x86 scenes with ground shadows, which read as clutter at row scale; these
 * are 24x24, flat-filled, no shadow, with a thinner outline so the silhouette
 * still holds at 16px. Colour is the whole point — a green avocado and a red
 * tomato are what make an inventory list feel like food rather than rows.
 *
 * This file is one of three on the design:static hardcoded-hex allowlist, so
 * literal produce colours are permitted here and nowhere else.
 * ------------------------------------------------------------------------ */

const glyphOutline = colors.text;
const glyphStroke = "1.3";

/** Shared props for every item glyph. */
export type ItemGlyphProps = { size?: number };

function GlyphSvg({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {children}
    </Svg>
  );
}

export function TomatoGlyph({ size = 20 }: ItemGlyphProps) {
  return (
    <GlyphSvg size={size}>
      <Circle cx="12" cy="14" r="7.2" fill="#E8453C" stroke={glyphOutline} strokeWidth={glyphStroke} />
      <Path
        d="M12 6.8c-2.6-.6-4-1.9-4.3-3.4 2 .1 3.7 1 4.3 3.4Z"
        fill="#3F8F4F"
        stroke={glyphOutline}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <Path
        d="M12 6.8c2.5-.7 3.6-2 3.9-3.4-2 .1-3.4 1-3.9 3.4Z"
        fill="#3F8F4F"
        stroke={glyphOutline}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <Path d="M12 6.6V4.4" stroke={glyphOutline} strokeWidth="1.2" strokeLinecap="round" />
    </GlyphSvg>
  );
}

export function AvocadoGlyph({ size = 20 }: ItemGlyphProps) {
  return (
    <GlyphSvg size={size}>
      <Path
        d="M12 3.2c3.3 0 5.6 3.4 5.6 7.4 0 5-2.4 9.8-5.6 9.8s-5.6-4.8-5.6-9.8c0-4 2.3-7.4 5.6-7.4Z"
        fill="#5C9A3C"
        stroke={glyphOutline}
        strokeWidth={glyphStroke}
        strokeLinejoin="round"
      />
      <Path
        d="M12 6.6c2 0 3.4 2.3 3.4 5.2 0 3.6-1.5 6.6-3.4 6.6s-3.4-3-3.4-6.6c0-2.9 1.4-5.2 3.4-5.2Z"
        fill="#CBE0A4"
      />
      <Circle cx="12" cy="13.2" r="2.5" fill="#8A5A2B" stroke={glyphOutline} strokeWidth="1" />
    </GlyphSvg>
  );
}

export function OnionGlyph({ size = 20 }: ItemGlyphProps) {
  return (
    <GlyphSvg size={size}>
      <Path
        d="M12 6.4c3.6 0 6.2 3 6.2 6.6 0 4-2.8 7-6.2 7s-6.2-3-6.2-7c0-3.6 2.6-6.6 6.2-6.6Z"
        fill="#A87BC4"
        stroke={glyphOutline}
        strokeWidth={glyphStroke}
        strokeLinejoin="round"
      />
      <Path d="M9.6 8.4c-.9 3-.9 6.4 0 9.6" fill="none" stroke="#6E4A88" strokeWidth="1" strokeLinecap="round" />
      <Path d="M14.4 8.4c.9 3 .9 6.4 0 9.6" fill="none" stroke="#6E4A88" strokeWidth="1" strokeLinecap="round" />
      <Path d="M12 6.3 10.4 3.3M12 6.3l1.7-3" stroke="#3F8F4F" strokeWidth="1.3" strokeLinecap="round" />
    </GlyphSvg>
  );
}

export function MeatGlyph({ size = 20 }: ItemGlyphProps) {
  // A cut with a bone nub reads as meat at 20px; the earlier organic blob did
  // not survive the scale.
  return (
    <GlyphSvg size={size}>
      <Path
        d="M9.4 5.6c4.2 0 7.4 2.9 7.4 6.6s-3.2 6.6-7.4 6.6c-2.5 0-4.4-1.2-4.4-3 0-1 .5-1.8 1.3-2.4-.8-.5-1.3-1.3-1.3-2.2 0-.9.5-1.7 1.3-2.2-.8-.6-1.3-1.4-1.3-2.4 0-.9.9-1 4.4-1Z"
        fill="#D9767A"
        stroke={glyphOutline}
        strokeWidth={glyphStroke}
        strokeLinejoin="round"
      />
      <Path
        d="M11 9c1.8 0 3.2 1.3 3.2 3.2S12.8 15.4 11 15.4"
        fill="none"
        stroke="#F6D2D4"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <Circle cx="18.4" cy="9.6" r="2.1" fill="#FFFFFF" stroke={glyphOutline} strokeWidth="1" />
      <Circle cx="18.4" cy="14.6" r="2.1" fill="#FFFFFF" stroke={glyphOutline} strokeWidth="1" />
    </GlyphSvg>
  );
}

export function LeafyGreenGlyph({ size = 20 }: ItemGlyphProps) {
  return (
    <GlyphSvg size={size}>
      <Path
        d="M12 20c-4.4 0-7.4-3-7.4-7 0-4.4 3.6-8.2 7.4-9.6 3.8 1.4 7.4 5.2 7.4 9.6 0 4-3 7-7.4 7Z"
        fill="#4E9B4A"
        stroke={glyphOutline}
        strokeWidth={glyphStroke}
        strokeLinejoin="round"
      />
      <Path d="M12 5.2V19" fill="none" stroke="#2F6B39" strokeWidth="1.1" strokeLinecap="round" />
      <Path
        d="M12 9.6 8.6 7.4M12 13.4l-3.8-2.2M12 9.6l3.4-2.2M12 13.4l3.8-2.2"
        fill="none"
        stroke="#2F6B39"
        strokeWidth=".9"
        strokeLinecap="round"
      />
    </GlyphSvg>
  );
}

export function DairyGlyph({ size = 20 }: ItemGlyphProps) {
  return (
    <GlyphSvg size={size}>
      <Path
        d="M8.6 3.4h6.8v2.4l2 3.4V20a1 1 0 0 1-1 1H7.6a1 1 0 0 1-1-1V9.2l2-3.4V3.4Z"
        fill="#F2F5FA"
        stroke={glyphOutline}
        strokeWidth={glyphStroke}
        strokeLinejoin="round"
      />
      <Path d="M6.6 12.4h10.8v4.2H6.6z" fill="#7FA8DC" />
      <Path d="M8.6 5.8h6.8" fill="none" stroke={glyphOutline} strokeWidth="1" strokeLinecap="round" />
    </GlyphSvg>
  );
}

export function GrainGlyph({ size = 20 }: ItemGlyphProps) {
  return (
    <GlyphSvg size={size}>
      <Path d="M12 20.4V7.6" fill="none" stroke="#B07A2B" strokeWidth="1.3" strokeLinecap="round" />
      <Path
        d="M12 8.2c-1.6-.7-2.5-2-2.6-3.6 1.6.2 2.6 1.4 2.6 3.6ZM12 8.2c1.6-.7 2.5-2 2.6-3.6-1.6.2-2.6 1.4-2.6 3.6ZM12 12.4c-1.6-.7-2.5-2-2.6-3.6 1.6.2 2.6 1.4 2.6 3.6ZM12 12.4c1.6-.7 2.5-2 2.6-3.6-1.6.2-2.6 1.4-2.6 3.6ZM12 16.6c-1.6-.7-2.5-2-2.6-3.6 1.6.2 2.6 1.4 2.6 3.6ZM12 16.6c1.6-.7 2.5-2 2.6-3.6-1.6.2-2.6 1.4-2.6 3.6Z"
        fill="#E0B15C"
        stroke={glyphOutline}
        strokeWidth=".9"
        strokeLinejoin="round"
      />
    </GlyphSvg>
  );
}

export function CitrusGlyph({ size = 20 }: ItemGlyphProps) {
  return (
    <GlyphSvg size={size}>
      <Circle cx="12" cy="13" r="7.4" fill="#F0B429" stroke={glyphOutline} strokeWidth={glyphStroke} />
      <Path
        d="M12 5.6V20.4M4.6 13h14.8M6.8 7.8l10.4 10.4M17.2 7.8 6.8 18.2"
        fill="none"
        stroke="#FDF0CE"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <Path
        d="M12 5.6c-.4-1.6.3-2.8 1.8-3.4.3 1.7-.3 2.9-1.8 3.4Z"
        fill="#3F8F4F"
        stroke={glyphOutline}
        strokeWidth=".9"
        strokeLinejoin="round"
      />
    </GlyphSvg>
  );
}

export function OilGlyph({ size = 20 }: ItemGlyphProps) {
  return (
    <GlyphSvg size={size}>
      <Path
        d="M10.4 2.8h3.2v2.6l2.8 3.6V20a1 1 0 0 1-1 1H8.6a1 1 0 0 1-1-1V9l2.8-3.6V2.8Z"
        fill="#EAF0DC"
        stroke={glyphOutline}
        strokeWidth={glyphStroke}
        strokeLinejoin="round"
      />
      <Path d="M7.6 12.6h8.8V19H7.6z" fill="#9CB84A" />
      <Circle cx="12" cy="15.8" r="1.5" fill="#EAF0DC" stroke={glyphOutline} strokeWidth=".9" />
    </GlyphSvg>
  );
}

export function PantryBoxGlyph({ size = 20 }: ItemGlyphProps) {
  return (
    <GlyphSvg size={size}>
      <Path
        d="M4.4 8.2 12 4.6l7.6 3.6v8.2L12 20l-7.6-3.6V8.2Z"
        fill="#E8DFD2"
        stroke={glyphOutline}
        strokeWidth={glyphStroke}
        strokeLinejoin="round"
      />
      <Path d="M4.4 8.2 12 11.8l7.6-3.6M12 11.8V20" fill="none" stroke={glyphOutline} strokeWidth="1" />
    </GlyphSvg>
  );
}
