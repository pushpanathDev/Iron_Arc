import { Ionicons } from "@expo/vector-icons";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { spacing, typography } from "../../theme/tokens";
import { Button } from "./Button";
import type { IconName } from "./iconName";

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  actionLoading,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[{ alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.sm }, style]}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.raised,
          alignItems: "center",
          justifyContent: "center",
        }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Ionicons name={icon} size={28} color={colors.textSecondary} />
      </View>
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.text, textAlign: "center" }]}>
        {title}
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", maxWidth: 320 }]}>{body}</Text>
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} loading={actionLoading} style={{ marginTop: spacing.xs, alignSelf: "center" }} />
      )}
      {secondaryActionLabel && onSecondaryAction && (
        <Button title={secondaryActionLabel} variant="secondary" onPress={onSecondaryAction} style={{ alignSelf: "center" }} />
      )}
    </View>
  );
}

export default EmptyState;
