import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import type { IconName } from "./iconName";
import { PressableScale } from "./PressableScale";

/** `tonal`: filled with surfaceContainerHigh, no border (e.g. "Continue with Google"). */
export type ButtonVariant = "primary" | "secondary" | "tonal" | "ghost" | "destructive";

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** Custom leading element, e.g. a brand logo. Overrides `icon`. */
  leading?: ReactNode;
  fullWidth?: boolean;
  uppercase?: boolean;
  /** Light haptic tap on press. */
  haptic?: boolean;
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
  leading,
  fullWidth = false,
  uppercase = false,
  haptic = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const palette = {
    primary: { bg: colors.accent, pressed: colors.accentPressed, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.raised, pressed: colors.surfaceContainerHigh, fg: colors.text, border: colors.border },
    tonal: {
      bg: colors.surfaceContainerHigh,
      pressed: colors.surfaceContainerHighest,
      fg: colors.text,
      border: colors.surfaceContainerHigh,
    },
    ghost: { bg: "transparent", pressed: colors.accentSubtle, fg: colors.accent, border: "transparent" },
    destructive: { bg: colors.danger, pressed: colors.dangerPressed, fg: colors.onDanger, border: colors.danger },
  }[variant];

  const showDisabledLook = disabled && !loading;
  const fg = showDisabledLook ? colors.textMuted : palette.fg;

  return (
    <PressableScale
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: size.control,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.lg,
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
      {/* The label stays laid out (invisible) while loading so the button never changes size. */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: leading ? spacing.md : spacing.sm, opacity: loading ? 0 : 1 }}
      >
        {leading ?? (icon && <Ionicons name={icon} size={size.icon} color={fg} />)}
        <Text
          style={[
            typography.labelLg,
            { color: fg },
            uppercase && { textTransform: "uppercase", letterSpacing: tracking.button },
          ]}
        >
          {title}
        </Text>
      </View>
      {loading && (
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={fg} />
        </View>
      )}
    </PressableScale>
  );
}

export default Button;
