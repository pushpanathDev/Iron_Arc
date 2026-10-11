import { Ionicons } from "@expo/vector-icons";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, spacing, typography } from "../../theme/tokens";
import type { IconName } from "./iconName";

/** `streak` and `record` are the only places amber may appear. */
export type StatTone = "default" | "streak" | "record";

export type StatTileProps = {
  value: string | number;
  label: string;
  unit?: string;
  icon?: IconName;
  tone?: StatTone;
  style?: StyleProp<ViewStyle>;
};

export function StatTile({ value, label, unit, icon, tone = "default", style }: StatTileProps) {
  const { colors } = useTheme();
  const emphasis = tone === "default" ? colors.text : colors.amber;
  const iconColor = tone === "default" ? colors.textSecondary : colors.amber;

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}
      style={[
        {
          flex: 1,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.xxs,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xxs }}>
        <Text style={[typography.number, { color: emphasis }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit && <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
        {icon && <Ionicons name={icon} size={14} color={iconColor} />}
        <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export default StatTile;
