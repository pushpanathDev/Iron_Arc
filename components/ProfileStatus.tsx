import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useTheme } from "../theme/theme";
import { radius, size, spacing, typography } from "../theme/tokens";
import { Button } from "./ui/Button";

interface ProfileStatusProps {
  title: string;
  message: string;
  onRetry: () => void;
  /** Slim banner (cached profile shown) instead of the full card. */
  compact?: boolean;
  retrying?: boolean;
}

/** "Profile unavailable" / "Showing saved profile" with a Retry button. */
export function ProfileStatus({ title, message, onRetry, compact = false, retrying = false }: ProfileStatusProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: compact ? "row" : "column",
        alignItems: compact ? "center" : "flex-start",
        gap: spacing.md,
        padding: compact ? spacing.md : spacing.lg,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.warning,
        backgroundColor: colors.raised,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md, flex: compact ? 1 : undefined }}>
        <MaterialIcons name="cloud-off" size={size.iconLg} color={colors.warning} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{title}</Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{message}</Text>
        </View>
      </View>
      <Button title="Retry" icon="refresh" variant="tonal" onPress={onRetry} loading={retrying} disabled={retrying} fullWidth={!compact} />
    </View>
  );
}

export default ProfileStatus;
