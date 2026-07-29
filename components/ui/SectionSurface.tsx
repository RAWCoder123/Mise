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
  /** Flat hairline group without rounded outer chrome (More lists). */
  flat?: boolean;
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
  flat = false,
  children,
  style,
  ...props
}: SectionSurfaceProps) {
  const hasHeader = Boolean(title);

  return (
    <View
      style={[
        styles.surface,
        flat && styles.flat,
        tone === "warm" && styles.warm,
        style
      ]}
      {...props}
    >
      {title ? (
        <View style={[styles.header, flat && styles.flatHeader, separatedHeader && styles.separatedHeader]}>
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
          flat && styles.flatContent,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  flat: {
    borderRadius: 0,
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface
  },
  warm: {
    backgroundColor: colors.surfaceWarm
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  flatHeader: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 8
  },
  separatedHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  content: {
    padding: 12
  },
  flatContent: {
    paddingHorizontal: 0
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
