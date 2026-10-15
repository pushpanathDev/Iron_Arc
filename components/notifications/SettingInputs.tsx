import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { RepeatButton } from "../ui/Stepper";
import { WEEKDAYS } from "../../data/trainingProfile";
import { REST_MAX_SECONDS, REST_MIN_SECONDS } from "../../notifications/notificationPlanner";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { showTime, clock } from "./settingsTime";

const REST_STEP_SECONDS = 15;

/** Default rest saves this long after the last step (holding + would otherwise save every tick). */
const REST_COMMIT_MS = 500;

/** Monday-first day circles; the whole circle takes the tap. */
export function DayChips({ value, onToggle }: { value: number[]; onToggle: (day: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.xs }}>
      {WEEKDAYS.map((d) => {
        const on = value.includes(d.value);
        return (
          <Pressable
            key={d.value}
            onPress={() => onToggle(d.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={d.long}
            style={({ pressed }) => ({
              flex: 1,
              maxWidth: size.control,
              aspectRatio: 1,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? colors.accent : pressed ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
            })}
          >
            <Text style={[typography.labelLg, { color: on ? colors.onAccent : colors.textSecondary }]}>{d.short.charAt(0)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TimePill({ time, onPress, label }: { time: string; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${showTime(time)}`}
      accessibilityHint="Change the time"
      hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
      })}
    >
      <MaterialIcons name="schedule" size={size.iconSm} color={colors.accent} />
      <Text style={[typography.labelLg, { color: colors.accent }]}>{showTime(time)}</Text>
    </Pressable>
  );
}

/** − 1:30 + in 15-second steps; hold to repeat. Shows each step at once, saves once you stop. */
export function RestStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors } = useTheme();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const commit = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    shownRef.current = value;
    setShown(value);
  }, [value]);
  useEffect(() => () => void (commit.current && clearTimeout(commit.current)), []);

  const step = (dir: 1 | -1) => {
    const next = Math.min(REST_MAX_SECONDS, Math.max(REST_MIN_SECONDS, shownRef.current + dir * REST_STEP_SECONDS));
    shownRef.current = next;
    setShown(next);
    if (commit.current) clearTimeout(commit.current);
    commit.current = setTimeout(() => onChange(shownRef.current), REST_COMMIT_MS);
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xxs, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
      <RepeatButton icon="remove" onStep={() => step(-1)} label="Less rest" />
      <Text style={[typography.headlineSm, { minWidth: size.control, textAlign: "center", color: colors.text, fontVariant: ["tabular-nums"] }]} accessibilityLabel={`Default rest ${clock(shown)}`}>
        {clock(shown)}
      </Text>
      <RepeatButton icon="add" onStep={() => step(1)} label="More rest" />
    </View>
  );
}
