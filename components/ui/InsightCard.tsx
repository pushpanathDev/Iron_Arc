import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/theme";

type Props = {
  title?: string;
  message: string;
};

export default function InsightCard({
  title = "This Week’s Insight",
  message,
}: Props) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderLeftWidth: 4,
        borderLeftColor: colors.accent,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: spacing.xs,
        }}
      >
        <Ionicons name="sparkles" size={16} color={colors.accent} />
        <Text
          style={{
            marginLeft: spacing.xs,
            fontSize: 14,
            color: colors.textSecondary,
          }}
        >
          {title}
        </Text>
      </View>

      <Text
        style={{
          fontSize: 16,
          color: colors.textPrimary,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
