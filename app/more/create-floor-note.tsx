import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { StyleSheet, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  createFloorNote,
  type FloorNoteFocusArea,
  type FloorNoteTiming
} from "../../services/miseService";
import { captureMiseError } from "../../services/telemetry";

type FocusChoice = FloorNoteFocusArea | "none";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function CreateFloorNoteScreen() {
  const { t } = useLocale();
  const { restaurant } = useMiseSession();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [timing, setTiming] = useState<FloorNoteTiming>("now");
  const [focus, setFocus] = useState<FocusChoice>("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    setTitle("");
    setNote("");
    setTiming("now");
    setFocus("none");
    setError(null);
    setSaved(false);
    setSaving(false);
  }, [restaurant?.id]);

  const timingOptions = useMemo<readonly SegmentOption<FloorNoteTiming>[]>(
    () => [
      { value: "now", label: t("floorNotes.timing.now"), tone: "danger" },
      { value: "up_next", label: t("floorNotes.timing.upNext"), tone: "brand" },
      { value: "later", label: t("floorNotes.timing.later"), tone: "neutral" }
    ],
    [t]
  );

  const focusOptions = useMemo<readonly SegmentOption<FocusChoice>[]>(
    () =>
      (
        [
          { value: "none", labelKey: "floorNotes.focus.none" },
          { value: "inventory", labelKey: "floorNotes.focus.inventory" },
          { value: "orders", labelKey: "floorNotes.focus.orders" },
          { value: "insights", labelKey: "floorNotes.focus.insights" },
          { value: "ask", labelKey: "floorNotes.focus.ask" }
        ] as const
      ).map(({ value, labelKey }) => ({
        value,
        label: t(labelKey as MessageKey)
      })),
    [t]
  );

  const actionsEditable = Boolean(restaurant) && !saving;

  async function save() {
    if (!restaurant || !actionsEditable) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t("floorNotes.error.titleRequired"));
      setSaved(false);
      return;
    }

    const restaurantId = restaurant.id;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await createFloorNote({
        restaurantId,
        title: trimmedTitle,
        note,
        timing,
        focusArea: focus === "none" ? null : focus
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setSaved(true);
      setTitle("");
      setNote("");
      setTiming("now");
      setFocus("none");
    } catch (saveError) {
      captureMiseError(saveError, {
        flow: "floor_notes",
        operation: "create",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setError(t("floorNotes.error.save"));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  if (!restaurant) {
    return (
      <Screen title={t("floorNotes.create.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("floorNotes.noRestaurant.body")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("floorNotes.create.title")}
      subtitle={t("floorNotes.create.subtitle")}
      titleAlign="center"
      leadingAction={<BackAction />}
      keyboardAware
    >
      <View style={styles.stack}>
        <StatusNotice
          tone="neutral"
          title={t("floorNotes.create.noticeTitle")}
          message={t("floorNotes.create.noticeBody")}
        />

        {error ? <StatusNotice tone="danger" title={t("common.error")} message={error} /> : null}
        {saved ? (
          <StatusNotice
            tone="success"
            title={t("floorNotes.create.successTitle")}
            message={t("floorNotes.create.successBody")}
          />
        ) : null}

        <SectionHeader title={t("floorNotes.field.title")} />
        <TextInput
          accessibilityLabel={t("floorNotes.field.title")}
          placeholder={t("floorNotes.field.titlePlaceholder")}
          placeholderTextColor={colors.faint}
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          maxLength={120}
          editable={actionsEditable}
          autoFocus
        />

        <SectionHeader title={t("floorNotes.field.note")} />
        <TextInput
          accessibilityLabel={t("floorNotes.field.note")}
          placeholder={t("floorNotes.field.notePlaceholder")}
          placeholderTextColor={colors.faint}
          value={note}
          onChangeText={setNote}
          style={[styles.input, styles.bodyInput]}
          multiline
          maxLength={2000}
          textAlignVertical="top"
          editable={actionsEditable}
        />

        <SectionHeader title={t("floorNotes.field.timing")} />
        <SegmentedControl
          accessibilityLabel={t("floorNotes.field.timing")}
          options={timingOptions}
          value={timing}
          onValueChange={setTiming}
          variant="pills"
        />

        <SectionHeader title={t("floorNotes.field.focus")} />
        <SegmentedControl
          accessibilityLabel={t("floorNotes.field.focus")}
          options={focusOptions}
          value={focus}
          onValueChange={setFocus}
          variant="pills"
          scrollable
        />

        <Button
          title={saving ? t("common.saving") : t("floorNotes.create.save")}
          onPress={() => void save()}
          disabled={!actionsEditable}
          fullWidth
        />

        {saved ? (
          <View style={styles.afterSave}>
            <Button
              title={t("floorNotes.create.goToday")}
              variant="secondary"
              onPress={() => router.push("/today")}
              fullWidth
            />
            <Button
              title={t("floorNotes.create.addAnother")}
              variant="secondary"
              onPress={() => {
                setSaved(false);
                setError(null);
              }}
              fullWidth
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...typography.body
  },
  bodyInput: {
    minHeight: 96
  },
  afterSave: {
    gap: 8
  }
});
