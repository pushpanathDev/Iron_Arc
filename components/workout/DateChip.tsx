import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { formatDate, parseLocalDate } from "../../utils/weekUtils";

const MINUTE_MS = 60_000;

export function DateChip({ date, onPress }: { date: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 24 * 60 * MINUTE_MS));
  const label =
    !date || date === today
      ? "Today"
      : date === yesterday
        ? "Yesterday"
        : parseLocalDate(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Workout date: ${label}`}
      accessibilityHint="Change the date (past dates allowed)"
      style={({ pressed }) => ({
        minHeight: size.control,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xxs,
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
        marginRight: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
      })}
    >
      <Text style={[typography.labelLg, { color: colors.text }]}>{label}</Text>
      <MaterialIcons name="arrow-drop-down" size={size.iconLg} color={colors.textSecondary} />
    </Pressable>
  );
}
