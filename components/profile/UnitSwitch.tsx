import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

/** kg / lb segmented switch; each half takes the tap across its box. */
export function UnitSwitch({ unit, onChange }: { unit: "kg" | "lbs"; onChange: (u: "kg" | "lbs") => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Weight unit" style={{ flexDirection: "row", padding: spacing.xxs, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
      {(["kg", "lbs"] as const).map((u) => {
        const on = unit === u;
        return (
          <Pressable
            key={u}
            onPress={() => onChange(u)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={u === "kg" ? "Kilograms" : "Pounds"}
            style={{ minWidth: size.control, minHeight: size.control - spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.accent : "transparent" }}
          >
            <Text style={[typography.labelLg, { color: on ? colors.onAccent : colors.textSecondary }]}>{u === "kg" ? "kg" : "lb"}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
