import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { formatDate } from "../../utils/weekUtils";

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const CELL = size.control - spacing.sm;
const CELL_SLOP = spacing.xs;

export type MonthCalendarProps = {
  /** Any date in the month shown. */
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  /** Date keys (YYYY-MM-DD) with at least one workout. */
  trainedDays: Set<string>;
  selected: string | null;
  /** Tap a day to select it; tap the selected day again to clear. */
  onSelect: (dateKey: string | null) => void;
  todayKey: string;
  /** True summary line for the month, e.g. "9 training days · 112,400 kg". */
  footer?: string;
};

/** Compact Monday-first month grid: dot = trained, ring = today, filled = selected. */
export const MonthCalendar = memo(function MonthCalendar({ month, onPrev, onNext, trainedDays, selected, onSelect, todayKey, footer }: MonthCalendarProps) {
  const { colors } = useTheme();
  const year = month.getFullYear();
  const m = month.getMonth();
  const isCurrentMonth = formatDate(new Date(year, m, 1)).slice(0, 7) === todayKey.slice(0, 7);

  const cells = useMemo(() => {
    const first = new Date(year, m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(year, m + 1, 0).getDate();
    const out: ({ key: string; day: number } | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push({ key: formatDate(new Date(year, m, d)), day: d });
    while (out.length % 7) out.push(null);
    return out;
  }, [year, m]);

  const monthName = month.toLocaleDateString(undefined, { month: "long" });

  return (
    <View style={{ padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.raised, gap: spacing.sm }}>
      {/* Month navigation */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide, paddingLeft: spacing.xs }]}>
          {monthName} <Text style={{ color: colors.textSecondary }}>{year}</Text>
        </Text>
        <View style={{ flexDirection: "row" }}>
          <NavButton icon="chevron-left" label="Previous month" onPress={onPrev} />
          <NavButton icon="chevron-right" label="Next month" onPress={onNext} disabled={isCurrentMonth} />
        </View>
      </View>

      {/* Weekday letters */}
      <View style={{ flexDirection: "row" }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEK_LETTERS.map((l, i) => (
          <Text key={i} style={[typography.labelSm, { flex: 1, textAlign: "center", color: i >= 5 ? colors.textMuted : colors.textSecondary }]}>
            {l}
          </Text>
        ))}
      </View>

      {/* Days */}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((c, i) =>
          c ? (
            <DayCell
              key={c.key}
              dateKey={c.key}
              day={c.day}
              trained={trainedDays.has(c.key)}
              today={c.key === todayKey}
              selected={c.key === selected}
              future={c.key > todayKey}
              onSelect={onSelect}
            />
          ) : (
            <View key={`pad${i}`} style={{ width: `${100 / 7}%`, height: CELL }} />
          ),
        )}
      </View>

      {footer ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: spacing.xs, paddingLeft: spacing.xs }}>
          <MaterialIcons name="insights" size={size.iconSm} color={colors.textSecondary} />
          <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{footer}</Text>
        </View>
      ) : null}
    </View>
  );
});

function NavButton({ icon, label, onPress, disabled }: { icon: "chevron-left" | "chevron-right"; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        width: size.control,
        height: size.control,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
      })}
    >
      <MaterialIcons name={icon} size={size.iconLg} color={disabled ? colors.textMuted : colors.text} />
    </Pressable>
  );
}

const DayCell = memo(function DayCell({
  dateKey,
  day,
  trained,
  today,
  selected,
  future,
  onSelect,
}: {
  dateKey: string;
  day: number;
  trained: boolean;
  today: boolean;
  selected: boolean;
  future: boolean;
  onSelect: (key: string | null) => void;
}) {
  const { colors } = useTheme();
  const textColor = selected ? colors.onAccent : future ? colors.textMuted : today ? colors.accent : trained ? colors.text : colors.textSecondary;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onSelect(selected ? null : dateKey);
      }}
      disabled={future}
      hitSlop={CELL_SLOP}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: future }}
      accessibilityLabel={`${new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${trained ? ", trained" : ""}${today ? ", today" : ""}`}
      style={{ width: `${100 / 7}%`, height: CELL, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: CELL - spacing.sm,
          height: CELL - spacing.sm,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.accent : "transparent",
          borderWidth: today && !selected ? size.divider * 2 : 0,
          borderColor: colors.accent,
        }}
      >
        <Text style={[trained || today || selected ? typography.labelLg : typography.labelMd, { color: textColor }]}>{day}</Text>
        {trained && !selected && (
          <View style={{ position: "absolute", bottom: spacing.xxs, width: size.dot - 1, height: size.dot - 1, borderRadius: radius.full, backgroundColor: colors.accent }} />
        )}
      </View>
    </Pressable>
  );
});

export default MonthCalendar;
