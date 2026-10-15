import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

/** Mimics the Android shade: app tile, "Iron Arc · now", title and body. */
export function PreviewCard({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Preview: ${title}. ${body}`}
      style={{ flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ width: size.tileSm, height: size.tileSm, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSubtle }}>
        <MaterialIcons name="fitness-center" size={size.iconSm} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Iron Arc · now</Text>
        <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{title}</Text>
        <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}
