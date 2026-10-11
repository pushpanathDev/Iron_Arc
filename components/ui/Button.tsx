import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, spacing, touchTarget, typography } from "../../theme/tokens";
import type { IconName } from "./iconName";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const palette = {
    primary: { bg: colors.accent, pressed: colors.accentPressed, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.raised, pressed: colors.border, fg: colors.text, border: colors.border },
    ghost: { bg: "transparent", pressed: colors.accentSubtle, fg: colors.accent, border: "transparent" },
    destructive: { bg: colors.danger, pressed: colors.dangerPressed, fg: colors.onDanger, border: colors.danger },
  }[variant];

  const showDisabledLook = disabled && !loading;
  const fg = showDisabledLook ? colors.textMuted : palette.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: touchTarget,
          paddingHorizontal: spacing.ml,
          borderRadius: radius.md,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: fullWidth ? "stretch" : "flex-start",
          backgroundColor: showDisabledLook
            ? variant === "ghost"
              ? "transparent"
              : colors.raised
            : pressed
              ? palette.pressed
              : palette.bg,
          borderColor: showDisabledLook && variant !== "ghost" ? colors.border : palette.border,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          icon && <Ionicons name={icon} size={20} color={fg} />
        )}
        <Text style={[typography.body, { color: fg, fontWeight: "600" }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

export default Button;
