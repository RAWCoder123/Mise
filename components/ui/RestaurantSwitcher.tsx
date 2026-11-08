import { router } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, conceptTypography, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { normalizeRestaurantSwitcherDisplayName } from "../../services/domain/presentationRestaurantSwitcherDisplayNameIdentity";

/**
 * Compact restaurant chip that sits directly under the Mise wordmark.
 *
 * The concept keeps this small on purpose: the restaurant is named once, in a
 * chip that reads as context rather than as a control bar, so the greeting and
 * the operating picture start within the first 100pt of the screen.
 */
export function RestaurantSwitcher({ name }: { name: string }) {
  const { t } = useLocale();

  // MISE-005ZN: soft-null blank / Unicode-padded / control-bearing restaurant
  // names before RestaurantSwitcher chip display Text. Soft-null falls through
  // to screen.restaurantSwitcher.name.none without inventing clean restaurant
  // identity from NBSP/em-space padding. Leave a11y `name` interpolation
  // (#1079 / MISE-005XS), Autonomy subtitle restaurant.name (#1043), Home
  // greeting restaurant.name (#1044), Ask Mise restaurant.name (#1045), and
  // Today screen title restaurant name (#968) alone.
  const restaurantSwitcherDisplayName = normalizeRestaurantSwitcherDisplayName(name);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("screen.openRestaurantSettings", { restaurant: name })}
        hitSlop={HIT_SLOP}
        onPress={() => router.push("/settings")}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={styles.label}>
          {restaurantSwitcherDisplayName || t("screen.restaurantSwitcher.name.none")}
        </Text>
        <ChevronDown size={13} color={colors.muted} strokeWidth={iconStroke} />
      </Pressable>
    </View>
  );
}

/** A 26pt chip reaches the 44pt target through slop, not through height. */
const HIT_SLOP = { top: 10, bottom: 10, left: 8, right: 8 } as const;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row"
  },
  chip: {
    maxWidth: 240,
    height: 26,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radii.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface
  },
  label: {
    flexShrink: 1,
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  pressed: {
    opacity: 0.68
  }
});
