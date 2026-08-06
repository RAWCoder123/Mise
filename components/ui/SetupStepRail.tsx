import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { colors, typography } from "../../constants/theme";

export type SetupStepStatus = "complete" | "active" | "missing" | "locked";

export interface SetupStepRailItem {
  id: string;
  label: string;
  detail?: string;
  status: SetupStepStatus;
}

interface SetupStepRailProps {
  steps: SetupStepRailItem[];
  onStepPress?: (id: string) => void;
}

export function SetupStepRail({ steps, onStepPress }: SetupStepRailProps) {
  return (
    <View style={styles.rail}>
      {steps.map((step, index) => {
        const active = step.status === "active";
        const complete = step.status === "complete";
        const previousComplete = steps[index - 1]?.status === "complete";
        return (
          <View key={step.id} style={styles.stepWrap}>
            <Pressable
              accessibilityRole={onStepPress ? "button" : undefined}
              accessibilityState={{ selected: active, disabled: !onStepPress }}
              disabled={!onStepPress}
              onPress={() => onStepPress?.(step.id)}
              style={styles.stepButton}
            >
              <View style={styles.markerRow}>
                {index > 0 ? (
                  <View style={[styles.connectorSegment, previousComplete && styles.connectorActive]} />
                ) : (
                  <View style={styles.connectorSpacer} />
                )}
                <View style={[styles.marker, active && styles.activeMarker, complete && styles.completeMarker]}>
                  {complete ? (
                    <Check size={12} color={colors.surface} strokeWidth={3} />
                  ) : (
                    <Text style={[styles.markerText, active && styles.activeMarkerText]}>{index + 1}</Text>
                  )}
                </View>
                {index < steps.length - 1 ? (
                  <View style={[styles.connectorSegment, complete && styles.connectorActive]} />
                ) : (
                  <View style={styles.connectorSpacer} />
                )}
              </View>
              <Text style={[styles.stepLabel, active && styles.activeLabel]} numberOfLines={1}>
                {step.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 2,
    paddingVertical: 2
  },
  stepWrap: {
    flex: 1,
    alignItems: "center"
  },
  stepButton: {
    width: "100%",
    minHeight: 54,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 5
  },
  markerRow: {
    width: "100%",
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    position: "relative"
  },
  connectorSegment: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.border
  },
  connectorSpacer: {
    flex: 1,
    height: 2,
    marginHorizontal: 8
  },
  connectorActive: {
    backgroundColor: colors.success
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    zIndex: 2
  },
  activeMarker: {
    borderColor: colors.accentDark,
    backgroundColor: colors.accentDark
  },
  completeMarker: {
    borderColor: colors.success,
    backgroundColor: colors.success
  },
  markerText: {
    color: colors.muted,
    ...typography.caption,
    fontSize: 13,
    lineHeight: 16
  },
  activeMarkerText: {
    color: colors.surface
  },
  stepLabel: {
    color: colors.text,
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center"
  },
  activeLabel: {
    color: colors.text
  }
});
