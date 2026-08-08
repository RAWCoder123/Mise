import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, CircleCheck, CircleDashed } from "lucide-react-native";

import { colors, icon as iconScale, iconStroke, radii, typography } from "../../constants/theme";
import { Button } from "./Button";

interface SetupChecklistCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

interface SetupBulletRowProps {
  title: string;
  detail?: string;
  complete?: boolean;
  trailing?: ReactNode;
}

interface SetupImportRowProps {
  title: string;
  detail: string;
  icon: ReactNode;
  onPress?: () => void;
  actionLabel?: string;
}

export function SetupChecklistCard({ title, description, children }: SetupChecklistCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function SetupBulletRow({ title, detail, complete, trailing }: SetupBulletRowProps) {
  return (
    <View style={styles.bulletRow}>
      {complete ? (
        <CircleCheck size={iconScale.emphasis} color={colors.success} strokeWidth={iconStroke} />
      ) : (
        <CircleDashed size={iconScale.emphasis} color={colors.faint} strokeWidth={iconStroke} />
      )}
      <View style={styles.bulletCopy}>
        <Text style={styles.bulletTitle} numberOfLines={1}>{title}</Text>
        {detail ? <Text style={styles.bulletDetail} numberOfLines={2}>{detail}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

export function SetupImportRow({ title, detail, icon, onPress, actionLabel = "Add" }: SetupImportRowProps) {
  const isActionable = typeof onPress === "function";

  return (
    <Pressable
      accessibilityRole={isActionable ? "button" : undefined}
      disabled={!isActionable}
      onPress={onPress}
      style={({ pressed }) => [styles.importRow, pressed && isActionable && styles.pressed]}
    >
      <View style={styles.importIcon}>{icon}</View>
      <View style={styles.bulletCopy}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletDetail}>{detail}</Text>
      </View>
      {isActionable ? (
        <View style={styles.importAction}>
          <Text style={styles.importActionText}>{actionLabel}</Text>
          <ChevronRight size={iconScale.row} color={colors.faint} strokeWidth={iconStroke} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function SetupAddButton({ title, onPress }: { title: string; onPress: () => void }) {
  return <Button title={title} onPress={onPress} fullWidth style={styles.addButton} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  title: {
    color: colors.text,
    ...typography.cardTitle
  },
  description: {
    color: colors.muted,
    ...typography.body,
    marginTop: 4
  },
  content: {
    gap: 10,
    marginTop: 12
  },
  bulletRow: {
    minHeight: 56,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  bulletCopy: {
    flex: 1,
    minWidth: 0
  },
  bulletTitle: {
    color: colors.text,
    ...typography.caption,
    fontSize: 14,
    lineHeight: 19
  },
  bulletDetail: {
    color: colors.muted,
    ...typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  importRow: {
    minHeight: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  importIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center"
  },
  importAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  importActionText: {
    color: colors.text,
    ...typography.caption,
    fontSize: 13,
    lineHeight: 17
  },
  addButton: {
    marginTop: 4
  },
  pressed: {
    opacity: 0.72
  }
});
