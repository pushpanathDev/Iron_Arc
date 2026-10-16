import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import type { IconName } from "./iconName";
import { GlossFill } from "./GlossFill";
import { PressableScale } from "./PressableScale";

/** `tonal`: filled with surfaceContainerHigh, no border (e.g. "Continue with Google"). */
/** `ghostDanger`: text-only in the error colour (e.g. "Delete set"). */
/** `dangerTonal`: soft red gradient, red label (the delete dialog's confirm). */
/** `neutral`: soft grey gradient, for the calm choice beside a destructive one (Cancel). */
export type ButtonVariant = "primary" | "secondary" | "tonal" | "ghost" | "destructive" | "ghostDanger" | "dangerTonal" | "neutral";

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** Custom leading element, e.g. a brand logo. Overrides `icon`. */
  leading?: ReactNode;
  /** Icon after the label, e.g. an arrow on a "Continue" button. */
  trailingIcon?: IconName;
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
  trailingIcon,
  fullWidth = false,
  uppercase = false,
  haptic = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const { colors, gloss } = useTheme();
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
    ghostDanger: { bg: "transparent", pressed: colors.surfaceContainerHigh, fg: colors.danger, border: "transparent" },
    dangerTonal: { bg: colors.dangerGradientBottom, pressed: colors.dangerGradientBottom, fg: colors.danger, border: colors.dangerGradientTop },
    neutral: { bg: colors.surfaceContainerHigh, pressed: colors.surfaceContainerHighest, fg: colors.text, border: colors.border },
  }[variant];
  const gradient = disabled
    ? null
    : variant === "neutral"
      ? ([colors.surfaceContainerHighest, colors.surfaceContainerHigh] as const)
      : variant === "dangerTonal"
        ? ([colors.dangerGradientTop, colors.dangerGradientBottom] as const)
        : null;

  const glossy = !!gloss && variant === "primary" && !disabled;
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
            ? variant === "ghost" || variant === "ghostDanger"
              ? "transparent"
              : colors.raised
            : pressed
              ? palette.pressed
              : palette.bg,
          borderColor: showDisabledLook && variant !== "ghost" && variant !== "ghostDanger" ? colors.border : pressed && variant === "dangerTonal" ? colors.danger : palette.border,
          overflow: gradient || glossy ? "hidden" : undefined,
        },
        style,
      ]}
    >
      {glossy && <GlossFill gloss={gloss} accent={colors.accent} />}
      {gradient && (
        <LinearGradient
          pointerEvents="none"
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
      )}
      {/* The label stays laid out (invisible) while loading so the button never changes size.
          Content never takes touches: the whole button box is the tap target. */}
      <View
        pointerEvents="none"
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
        {trailingIcon && <Ionicons name={trailingIcon} size={size.icon} color={fg} />}
      </View>
      {loading && (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={fg} />
        </View>
      )}
    </PressableScale>
  );
}
