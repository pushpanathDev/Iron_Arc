import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { defaultSplitFor, MAX_TRAINING_DAYS, SPLIT_LABELS, WEEKDAYS, type Weekday } from "../../constants/trainingProfile";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { FadingMessage } from "../ui/FadingMessage";

export type TrainingDaysPickerProps = {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
};

/**
 * "Which days do you train?" Seven day toggles, up to 6 (one rest day
 * minimum). Shows the count and the split a plan would use for it.
 */
export function TrainingDaysPicker({ value, onChange }: TrainingDaysPickerProps) {
  const { colors } = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const count = value.length;

  const toggle = (day: Weekday) => {
    if (value.includes(day)) {
      Haptics.selectionAsync().catch(() => {});
      setNote(null);
      onChange(value.filter((d) => d !== day));
      return;
    }
    if (count >= MAX_TRAINING_DAYS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setNote(`Up to ${MAX_TRAINING_DAYS} days: keep at least one rest day.`);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setNote(null);
    onChange([...value, day].sort((a, b) => a - b) as Weekday[]);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {WEEKDAYS.map((d) => {
          const on = value.includes(d.value);
          return (
            <Pressable
              key={d.value}
              onPress={() => toggle(d.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={d.long}
              style={({ pressed }) => ({
                flex: 1,
                height: size.control,
                borderRadius: radius.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: on ? colors.accent : pressed ? colors.surfaceContainerHigh : colors.surfaceContainerLowest,
              })}
            >
              <Text pointerEvents="none" style={[typography.labelMd, { color: on ? colors.onAccent : colors.textSecondary }]}>
                {d.short}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View accessible accessibilityLiveRegion="polite" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[typography.labelMd, { color: colors.text }]}>
          {count === 0 ? "Pick at least one day" : `${count} ${count === 1 ? "day" : "days"} a week`}
        </Text>
        {count > 0 && <Text style={[typography.labelSm, { color: colors.accent }]}>{SPLIT_LABELS[defaultSplitFor(count)]}</Text>}
      </View>
      <FadingMessage message={note} color={colors.warning} live />
    </View>
  );
}

export default TrainingDaysPicker;
