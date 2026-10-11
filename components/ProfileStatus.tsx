import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/theme";

interface ProfileStatusProps {
  title: string;
  message: string;
  onRetry: () => void;
  compact?: boolean;
  retrying?: boolean;
}

export function ProfileStatus({
  title,
  message,
  onRetry,
  compact = false,
  retrying = false,
}: ProfileStatusProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: compact ? spacing.md : spacing.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        marginBottom: spacing.md,
      }}
    >
      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
        {title}
      </Text>
      <Text
        style={{
          ...typography.caption,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        disabled={retrying}
        style={{
          alignSelf: "flex-start",
          marginTop: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: colors.accent,
        }}
      >
        {retrying ? (
          <ActivityIndicator size="small" color={colors.textOnAccent} />
        ) : (
          <Text style={{ ...typography.bodyMedium, color: colors.textOnAccent }}>
            Retry
          </Text>
        )}
      </Pressable>
    </View>
  );
}
