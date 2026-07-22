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
    padding: 18,
    alignItems: "flex-start"
  },
  compact: {
    alignItems: "center",
    borderStyle: "dashed",
    backgroundColor: colors.background,
    paddingVertical: 22
  },
  framed: {
    alignItems: "center",
    borderStyle: "dashed",
    backgroundColor: colors.background
  },
  illustration: {
    alignSelf: "center",
    marginBottom: 8
  },
  title: {
    color: colors.text,
    ...typography.cardTitle,
    alignSelf: "center",
    textAlign: "center"
  },
  body: {
    color: colors.muted,
    ...typography.body,
    marginTop: 5,
    textAlign: "center",
    alignSelf: "center"
  }
});
