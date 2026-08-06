import { ScrollView, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, conceptTypography, radii } from "../../constants/theme";

export interface SegmentOption<Value extends string> {
  value: Value;
  label: string;
  /** Count chip rendered beside the label, e.g. "5". Narrower than "(5)". */
  badge?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  tone?: SegmentTone;
}

export type SegmentTone = "brand" | "success" | "caution" | "warning" | "danger" | "neutral";

export interface SegmentedControlProps<Value extends string> {
  options: readonly SegmentOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  accessibilityLabel: string;
  variant?: "segmented" | "pills" | "underline";
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A shared tab/filter control with mobile-safe targets and localized overflow. */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  variant = "segmented",
  scrollable = false,
  style
}: SegmentedControlProps<Value>) {
  const buttons = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={option.accessibilityLabel ?? option.label}
        accessibilityState={{ selected, disabled: option.disabled }}
        aria-selected={selected}
        disabled={option.disabled}
        hitSlop={variant === "pills" ? 9 : undefined}
        key={option.value}
        onPress={() => onValueChange(option.value)}
        style={({ pressed }) => [
          styles.option,
          !scrollable && styles.flexOption,
          variant === "pills" && styles.pillOption,
          variant === "underline" && styles.underlineOption,
          selected && variant !== "underline" && styles.selectedOption,
          variant === "pills" && selected && styles.selectedPill,
          variant === "pills" && selected && selectedPillToneStyles[option.tone ?? "brand"],
          variant === "underline" && selected && styles.selectedUnderline,
          option.disabled && styles.disabled,
          pressed && !option.disabled && styles.pressed
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            selected && styles.selectedLabel,
            variant === "pills" && selected && selectedLabelToneStyles[option.tone ?? "brand"],
            variant === "underline" && selected && styles.selectedUnderlineLabel
          ]}
        >
          {option.label}
        </Text>
        {option.badge ? (
          <Text
            numberOfLines={1}
            style={[styles.badge, selected && styles.badgeSelected]}
          >
            {option.badge}
          </Text>
        ) : null}
      </Pressable>
    );
  });

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="tablist" style={style}>
      {scrollable ? (
        <ScrollView
          horizontal
          contentContainerStyle={[
            styles.row,
            variant === "segmented" && styles.segmentedSurface,
            variant === "underline" && styles.underlineSurface
          ]}
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
        >
          {buttons}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.row,
            variant === "segmented" && styles.segmentedSurface,
            variant === "underline" && styles.underlineSurface
          ]}
        >
          {buttons}
        </View>
      )}
    </View>
  );
}

export function FilterRow<Value extends string>(
  props: Omit<SegmentedControlProps<Value>, "variant" | "scrollable">
) {
  return <SegmentedControl {...props} variant="pills" scrollable />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  segmentedSurface: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: 3,
    gap: 3
  },
  option: {
    flexDirection: "row",
    minHeight: 44,
    minWidth: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  flexOption: {
    flex: 1,
    minWidth: 0
  },
  pillOption: {
    borderRadius: radii.xl,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 30,
    height: 30,
    paddingHorizontal: 10,
    paddingVertical: 0
  },
  selectedOption: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface
  },
  selectedPill: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  underlineSurface: {
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  underlineOption: {
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    borderRadius: 0,
    paddingHorizontal: 8,
    marginBottom: -1
  },
  selectedUnderline: {
    borderBottomColor: colors.accent,
    backgroundColor: colors.surface
  },
  badge: {
    color: colors.muted,
    ...conceptTypography.micro,
    marginLeft: 4
  },
  badgeSelected: {
    color: colors.surface
  },
  label: {
    color: colors.muted,
    ...conceptTypography.caption,
    textAlign: "center"
  },
  selectedLabel: {
    color: colors.text
  },
  selectedUnderlineLabel: {
    color: colors.accentDark
  },
  disabled: {
    opacity: 0.46
  },
  pressed: {
    opacity: 0.68
  }
});

const selectedPillToneStyles: Record<SegmentTone, { backgroundColor: string; borderColor: string }> = {
  brand: { backgroundColor: colors.accent, borderColor: colors.accent },
  success: { backgroundColor: colors.success, borderColor: colors.success },
  caution: { backgroundColor: colors.caution, borderColor: colors.caution },
  warning: { backgroundColor: colors.warning, borderColor: colors.warning },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  neutral: { backgroundColor: colors.text, borderColor: colors.text }
};

const selectedLabelToneStyles: Record<SegmentTone, { color: string }> = {
  brand: { color: colors.surface },
  success: { color: colors.surface },
  caution: { color: colors.surface },
  warning: { color: colors.surface },
  danger: { color: colors.surface },
  neutral: { color: colors.surface }
};
