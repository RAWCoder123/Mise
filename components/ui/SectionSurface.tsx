import { StyleSheet, View, type ViewProps } from "react-native";

import { colors, radii } from "../../constants/theme";
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
    backgroundColor: colors.surface
  },
  warm: {
    backgroundColor: colors.surfaceWarm
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  separatedHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  content: {
    padding: 12
  },
  standaloneCompactPadding: {
    padding: 12
  },
  comfortablePadding: {
    padding: 14
  },
  noPadding: {
    padding: 0
  }
});
