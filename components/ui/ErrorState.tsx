import { Ionicons } from "@expo/vector-icons";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { spacing, typography } from "../../theme/tokens";
import { Button } from "./Button";
import type { IconName } from "./iconName";

export type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
  retrying = false,
  icon = "alert-circle-outline",
  style,
}: ErrorStateProps) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[{ alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.sm }, style]}
    >
      <Ionicons name={icon} size={36} color={colors.danger} accessibilityElementsHidden importantForAccessibility="no" />
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.text, textAlign: "center" }]}>
        {title}
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", maxWidth: 320 }]}>{message}</Text>
      {onRetry && (
        <Button
          title={retrying ? "Retrying…" : "Retry"}
          icon="refresh"
          variant="secondary"
          onPress={onRetry}
          loading={retrying}
          style={{ marginTop: spacing.xs, alignSelf: "center" }}
        />
      )}
    </View>
  );
}

export default ErrorState;
