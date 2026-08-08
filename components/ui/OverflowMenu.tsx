import { useState, type ReactNode } from "react";
import { EllipsisVertical } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, conceptTypography, density, icon, iconStroke, radii } from "../../constants/theme";
import { ActionIcon } from "./ActionIcon";

export interface OverflowMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
}

export interface OverflowMenuProps {
  items: readonly OverflowMenuItem[];
  accessibilityLabel: string;
}

/**
 * App-bar overflow. Deliberately minimal: a scrim plus an anchored sheet, not a
 * general popover framework. The app had no menu pattern at all before this.
 */
export function OverflowMenu({ items, accessibilityLabel }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <>
      <ActionIcon accessibilityLabel={accessibilityLabel} onPress={() => setOpen(true)}>
        <EllipsisVertical size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
      </ActionIcon>
      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPress={() => setOpen(false)}
          style={styles.scrim}
        >
          <View style={styles.sheet}>
            {items.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="menuitem"
                accessibilityState={{ disabled: item.disabled }}
                disabled={item.disabled}
                onPress={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                style={({ pressed }) => [
                  styles.item,
                  index > 0 && styles.itemDivided,
                  item.disabled && styles.itemDisabled,
                  pressed && !item.disabled && styles.pressed
                ]}
              >
                {item.icon ?? null}
                <Text
                  numberOfLines={1}
                  style={[styles.label, item.tone === "danger" && styles.labelDanger]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(23, 23, 21, 0.28)",
    alignItems: "flex-end",
    paddingTop: density.appBar,
    paddingHorizontal: density.gutter
  },
  sheet: {
    minWidth: 196,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  item: {
    minHeight: density.hitTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12
  },
  itemDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  itemDisabled: {
    opacity: 0.46
  },
  label: {
    flex: 1,
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  labelDanger: {
    color: colors.danger
  },
  pressed: {
    opacity: 0.68
  }
});
