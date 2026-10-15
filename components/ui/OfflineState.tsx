import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { spacing, typography } from "../../theme/tokens";
import { ErrorState } from "./ErrorState";

export type OfflineStateProps = {
  /** `waking`: server is starting up; `offline`: the request failed. */
  mode: "waking" | "offline";
  onRetry?: () => void;
  retrying?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function OfflineState({ mode, onRetry, retrying, style }: OfflineStateProps) {
  const { colors } = useTheme();

  if (mode === "waking") {
    return (
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessibilityLabel="Waking up the server"
        style={[{ alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.md }, style]}
      >
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[typography.bodyLg, { color: colors.textSecondary, textAlign: "center" }]}>Waking up the server…</Text>
      </View>
    );
  }

  return (
    <ErrorState
      icon="cloud-offline-outline"
      title="Can't reach the server"
      message="Check your connection."
      onRetry={onRetry}
      retrying={retrying}
      style={style}
    />
  );
}
