import { Pressable, Text, View } from "react-native";
import { TREND_RANGES, type TrendRange } from "./WeightTrendChart";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import type { WeightUnit } from "../../utils/unitConversion";

export function UnitToggle({ unit, onChange }: { unit: WeightUnit; onChange: (u: WeightUnit) => void }) {
  const { colors } = useTheme();
  const options: { value: WeightUnit; label: string }[] = [
    { value: "kg", label: "kg" },
    { value: "lbs", label: "lb" },
  ];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Weight unit" style={{ flexDirection: "row", padding: spacing.xxs, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
      {options.map((o) => {
        const active = o.value === unit;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.value === "kg" ? "Kilograms" : "Pounds"}
            style={{ minWidth: size.control, height: size.control - spacing.xs, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: active ? colors.surfaceContainerHighest : "transparent" }}
          >
            <Text style={[typography.labelLg, { color: active ? colors.text : colors.textSecondary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RangeToggle({ value, onChange }: { value: TrendRange; onChange: (r: TrendRange) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Time period" style={{ flexDirection: "row", padding: spacing.xxs, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
      {TREND_RANGES.map((r) => {
        const active = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            hitSlop={spacing.xs}
            style={{ minWidth: size.tileSm + spacing.sm, height: size.tileSm + spacing.xs, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: active ? colors.surfaceContainerHighest : "transparent" }}
          >
            <Text style={[typography.labelMd, { color: active ? colors.text : colors.textSecondary }]}>{r}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
