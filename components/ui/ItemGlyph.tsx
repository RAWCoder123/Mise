import { type ReactElement } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "../../constants/theme";
import {
  AvocadoGlyph,
  CitrusGlyph,
  DairyGlyph,
  GrainGlyph,
  LeafyGreenGlyph,
  MeatGlyph,
  OilGlyph,
  OnionGlyph,
  PantryBoxGlyph,
  TomatoGlyph
} from "./MiseIllustrations";

type GlyphComponent = (props: { size?: number }) => ReactElement;

/**
 * Name matches run first and win: an inventory item called "Roma tomatoes" is
 * filed under Produce, but drawing a tomato is the whole point.
 */
const NAME_GLYPHS: ReadonlyArray<readonly [RegExp, GlyphComponent]> = [
  [/tomato/i, TomatoGlyph],
  [/avocado|guac/i, AvocadoGlyph],
  [/onion|shallot|leek|garlic/i, OnionGlyph],
  [/lemon|lime|orange|citrus/i, CitrusGlyph],
  [/lettuce|cabbage|spinach|kale|green|herb|cilantro|basil/i, LeafyGreenGlyph],
  [/chicken|beef|pork|thigh|steak|protein|meat|bacon/i, MeatGlyph],
  [/milk|cheese|cream|butter|yogurt|dairy/i, DairyGlyph],
  [/rice|flour|grain|wheat|pasta|bread|bun/i, GrainGlyph],
  [/oil|sauce|vinegar|stock|broth/i, OilGlyph]
];

/** Category fallback, mirroring the tiers the inventory domain already uses. */
const CATEGORY_GLYPHS: ReadonlyArray<readonly [RegExp, GlyphComponent]> = [
  [/protein|meat|beef|chicken|poultry|seafood/i, MeatGlyph],
  [/produce|veg|fruit/i, LeafyGreenGlyph],
  [/dairy|milk|cheese/i, DairyGlyph],
  [/dry|grain|flour|rice|bakery/i, GrainGlyph],
  [/oil|sauce|liquid|condiment/i, OilGlyph]
];

export function resolveItemGlyph(itemName?: string, category?: string): GlyphComponent {
  const name = itemName?.trim() ?? "";
  if (name) {
    for (const [pattern, glyph] of NAME_GLYPHS) {
      if (pattern.test(name)) return glyph;
    }
  }
  const group = category?.trim() ?? "";
  if (group) {
    for (const [pattern, glyph] of CATEGORY_GLYPHS) {
      if (pattern.test(group)) return glyph;
    }
  }
  return PantryBoxGlyph;
}

export interface ItemGlyphProps {
  itemName?: string;
  category?: string;
  /** Diameter of the surrounding well. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A colourful food glyph in a soft well, used wherever an inventory item is
 * listed. This is the detail that makes a stock list read as food rather than
 * as rows, so the artwork stays in colour while the well stays neutral.
 */
export function ItemGlyph({ itemName, category, size = 30, style }: ItemGlyphProps) {
  const Glyph = resolveItemGlyph(itemName, category);
  return (
    <View
      style={[styles.well, { width: size, height: size, borderRadius: size / 2 }, style]}
      importantForAccessibility="no-hide-descendants"
    >
      <Glyph size={Math.round(size * 0.68)} />
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm
  }
});
