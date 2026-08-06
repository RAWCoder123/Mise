import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, typography } from "../../constants/theme";

export function EmptyState({
  title,
  body,
  illustration,
  compact,
  framed
}: {
  title: string;
  body: string;
  illustration?: ReactNode;
  compact?: boolean;
  /** Dashed border empty box (Setup "No items yet" style). */
  framed?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && styles.compact, framed && styles.framed]}>
      {illustration ? <View style={styles.illustration}>{illustration}</View> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: "flex-start"
  },
  compact: {
    alignItems: "center",
    borderStyle: "dashed",
    backgroundColor: colors.canvas,
    paddingVertical: 28
  },
  framed: {
    alignItems: "center",
    borderStyle: "dashed",
    backgroundColor: colors.canvas
  },
  illustration: {
    alignSelf: "center",
    marginBottom: 12
  },
  title: {
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 17,
    lineHeight: 22,
    alignSelf: "center",
    textAlign: "center"
  },
  body: {
    color: colors.muted,
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
    alignSelf: "center"
  }
});
