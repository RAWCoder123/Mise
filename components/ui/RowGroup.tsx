import { Children, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii } from "../../constants/theme";

interface RowGroupProps {
  children: ReactNode;
  /** `plain` drops the card frame and keeps only the separators. */
  variant?: "card" | "plain";
  style?: StyleProp<ViewStyle>;
}

/**
 * One bordered surface holding several hairline-separated rows.
 *
 * The reference groups by meaning, not by row: "Low stock items" is a single
 * object containing three rows, not three floating cards. Boxing each row
 * independently is what made the previous build read as a pile of generic
 * cards, so rows here render flush and the group owns the border and radius.
 *
 * Children opt out of their own bottom border; the last child never draws one.
 */
export function RowGroup({ children, variant = "card", style }: RowGroupProps) {
  const items = Children.toArray(children).filter(Boolean);

  return (
    <View style={[variant === "card" ? styles.card : styles.plain, style]}>
      {items.map((child, index) => (
        <View
          // Rows are positional and have no stable identity of their own; the
          // child carries its own key where the data has one.
          key={index}
          style={index < items.length - 1 ? styles.divided : undefined}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden"
  },
  plain: {
    backgroundColor: colors.surface
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  }
});
