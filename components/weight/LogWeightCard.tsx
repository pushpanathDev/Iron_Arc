import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, TextInput, View } from "react-native";
import type { WeightEntry } from "../../hooks/useWeightEntry";
import { useTheme } from "../../theme/theme";
import { alpha, radius, size, spacing, typography } from "../../theme/tokens";
import { maxFor, minFor, WEIGHT_STEP } from "../../utils/bodyWeightRules";
import { dayLabel, parseLocalDate, shortDate, timeOf } from "../../utils/dates";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { Button } from "../ui/Button";
import { RepeatButton } from "../ui/Stepper";
import { BathroomScale } from "./BathroomScale";

const fullDate = (key: string) => parseLocalDate(key).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

function saveTitle(hasEntry: boolean, logDate: string, todayKey: string) {
  if (logDate === todayKey) return hasEntry ? "Update today's entry" : "Save today's weight";
  const d = shortDate(logDate);
  return hasEntry ? `Update ${d} entry` : `Save weight for ${d}`;
}

/** Log or update a weigh-in: the day, the scale, steppers or typing, and Save. */
export function LogWeightCard({
  entry,
  unit,
  todayKey,
  saving,
  onPickDate,
  onSave,
}: {
  entry: WeightEntry;
  unit: WeightUnit;
  todayKey: string;
  saving: boolean;
  onPickDate: () => void;
  onSave: () => void;
}) {
  const { colors } = useTheme();
  const { logDate, existing } = entry;
  return (
    <View style={{ padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }}>
        <Pressable
          onPress={onPickDate}
          accessibilityRole="button"
          accessibilityLabel={`Logging for ${fullDate(logDate)}`}
          accessibilityHint="Change the date (past dates allowed)"
          style={({ pressed }) => ({ minHeight: size.control, justifyContent: "center", flexShrink: 1, opacity: pressed ? alpha.divider : 1 })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Text style={[typography.headlineSm, { color: colors.text }]}>{dayLabel(logDate, todayKey)}</Text>
            <MaterialIcons name="expand-more" size={size.icon} color={colors.textSecondary} />
          </View>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{fullDate(logDate)}</Text>
        </Pressable>
        {existing && (
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh }}>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Logged {timeOf(existing.updatedAt)}</Text>
          </View>
        )}
      </View>

      <BathroomScale value={entry.dialValue} unit={unit} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <RepeatButton icon="remove" onStep={() => entry.step(-1)} label={`Decrease by ${WEIGHT_STEP} ${weightLabel(unit)}`} filled />
        <View style={{ flex: 1, alignItems: "center", gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
            <TextInput
              value={entry.text}
              onChangeText={entry.type}
              onBlur={entry.stopTyping}
              keyboardType="decimal-pad"
              returnKeyType="done"
              selectTextOnFocus
              maxLength={6}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={`Weight in ${weightLabel(unit)}`}
              accessibilityHint={`Type an exact weight, ${minFor(unit)} to ${maxFor(unit)}`}
              style={[typography.headlineLg, { color: colors.text, textAlign: "center", minWidth: size.control, paddingVertical: 0 }]}
            />
            <Text style={[typography.headlineSm, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
          </View>
          <Text style={[typography.labelSm, { color: entry.showError ? colors.danger : colors.textSecondary, textAlign: "center" }]} accessibilityLiveRegion="polite">
            {entry.showError ? entry.error : `Tap the number to type · ± ${WEIGHT_STEP} ${weightLabel(unit)}`}
          </Text>
        </View>
        <RepeatButton icon="add" onStep={() => entry.step(1)} label={`Increase by ${WEIGHT_STEP} ${weightLabel(unit)}`} filled />
      </View>

      <Button
        title={saveTitle(!!existing, logDate, todayKey)}
        icon="checkmark"
        onPress={onSave}
        loading={saving}
        disabled={!!entry.error || saving}
        fullWidth
        haptic
        style={{ minHeight: size.ctaTall }}
      />
    </View>
  );
}
