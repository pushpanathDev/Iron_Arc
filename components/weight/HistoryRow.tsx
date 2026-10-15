import { MaterialIcons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { signed } from "./weightChange";
import type { BodyWeight } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { formatValue, toDisplay } from "../../utils/bodyWeightRules";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { dayLabel, timeOf } from "../../utils/dates";

export const HistoryRow = memo(function HistoryRow({
  item,
  diffKg,
  diffColor,
  unit,
  todayKey,
  onDelete,
  onEdit,
}: {
  item: BodyWeight;
  diffKg: number | null;
  diffColor: string;
  unit: WeightUnit;
  todayKey: string;
  onDelete: (item: BodyWeight) => void;
  onEdit: (item: BodyWeight) => void;
}) {
  const { colors } = useTheme();
  const date = item.date.slice(0, 10);
  const diff = diffKg == null ? null : toDisplay(diffKg, unit);
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={size.control}
      overshootRight={false}
      onSwipeableOpen={() => onDelete(item)}
      renderRightActions={() => (
        <View style={{ width: size.iconBadge + spacing.xl, marginLeft: spacing.sm, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: spacing.xxs, backgroundColor: colors.dangerSubtle }}>
          <MaterialIcons name="delete-outline" size={size.iconLg} color={colors.danger} />
          <Text style={[typography.labelMd, { color: colors.danger }]}>Delete</Text>
        </View>
      )}
    >
      <Pressable
        onPress={() => onEdit(item)}
        accessibilityRole="button"
        accessibilityLabel={`${dayLabel(date, todayKey)}, ${formatValue(toDisplay(item.weight, unit))} ${weightLabel(unit)}${diff != null ? `, ${signed(diff)} from the entry before` : ""}`}
        accessibilityHint="Edit this day's weight. Swipe left to delete."
        style={({ pressed }) => ({
          minHeight: size.exerciseRow,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.lg,
          backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
        })}
      >
        <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
          <MaterialIcons name="monitor-weight" size={size.icon} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text numberOfLines={1}>
            <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{dayLabel(date, todayKey)}</Text>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{`  ·  ${timeOf(item.updatedAt)}`}</Text>
          </Text>
          {diff != null && diff !== 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
              <MaterialIcons name={diff < 0 ? "arrow-drop-down" : "arrow-drop-up"} size={size.iconSm} color={diffColor} />
              <Text style={[typography.labelMd, { color: diffColor }]}>{formatValue(Math.abs(diff))}</Text>
            </View>
          ) : (
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{diff === 0 ? "No change" : "First entry"}</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xxs }}>
          <Text style={[typography.headlineMd, { color: colors.text }]}>{formatValue(toDisplay(item.weight, unit))}</Text>
          <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});
