import { StyleSheet, View, type ViewProps } from "react-native";

import { colors, radii, shadows } from "../../constants/theme";
import { SectionHeader } from "./SectionHeader";

export interface SectionSurfaceProps extends ViewProps {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
  tone?: "default" | "warm";
  padding?: "none" | "compact" | "comfortable";
  separatedHeader?: boolean;
}

/** A consistent bordered surface for compact operational sections and lists. */
export function SectionSurface({
  title,
  eyebrow,
  subtitle,
  action,
  onAction,
  actionAccessibilityLabel,
  tone = "default",
  padding = "compact",
  separatedHeader = true,
  children,
  style,
  ...props
}: SectionSurfaceProps) {
  const hasHeader = Boolean(title);

  return (
    <View style={[styles.surface, tone === "warm" && styles.warm, style]} {...props}>
      {title ? (
        <View style={[styles.header, separatedHeader && styles.separatedHeader]}>
          <SectionHeader
            title={title}
            eyebrow={eyebrow}
            subtitle={subtitle}
            action={action}
            onAction={onAction}
            actionAccessibilityLabel={actionAccessibilityLabel}
            size="compact"
          />
        </View>
      ) : null}
      <View
        style={[
          styles.content,
          padding === "none" && styles.noPadding,
          padding === "comfortable" && styles.comfortablePadding,
          !hasHeader && padding === "compact" && styles.standaloneCompactPadding
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card
  },
  warm: {
    backgroundColor: colors.surfaceWarm
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  separatedHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  content: {
    padding: 14
  },
  standaloneCompactPadding: {
    padding: 14
  },
  comfortablePadding: {
    padding: 16
  },
  noPadding: {
    padding: 0
  }
});
