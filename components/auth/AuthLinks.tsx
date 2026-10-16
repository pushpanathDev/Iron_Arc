import { Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { alpha, size, spacing, touchTarget, tracking, typography, withAlpha } from "../../theme/tokens";
import { PressableScale } from "../ui/PressableScale";

/** "— or —" between email sign-in and Google. */
export function OrDivider() {
  const { colors } = useTheme();
  const line = <View style={{ flex: 1, height: size.divider, backgroundColor: colors.surfaceContainerHigh }} />;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg, marginVertical: spacing.sm }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {line}
      <Text style={[typography.labelSm, { color: withAlpha(colors.textSecondary, alpha.divider), textTransform: "uppercase", letterSpacing: tracking.overline }]}>or</Text>
      {line}
    </View>
  );
}

/** "Forgot password?" beside the sign-in error line. */
export function ForgotPasswordLink({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const slop = (touchTarget - size.linkMin) / 2;
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop }}
      accessibilityRole="button"
      accessibilityLabel="Forgot password"
      style={{ minHeight: size.linkMin, justifyContent: "center" }}
    >
      {({ pressed }) => <Text style={[typography.labelMd, { color: pressed ? colors.text : colors.textSecondary }]}>Forgot password?</Text>}
    </PressableScale>
  );
}

/** "Don't have an account? Create account" / "Already have an account? Sign in". */
export function ModeSwitch({ isSignup, disabled, onSwitch }: { isSignup: boolean; disabled: boolean; onSwitch: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.xxl, minHeight: touchTarget, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: spacing.inline }}>
      <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{isSignup ? "Already have an account?" : "Don't have an account?"}</Text>
      <PressableScale
        onPress={onSwitch}
        accessibilityRole="button"
        accessibilityLabel={isSignup ? "Sign in instead" : "Create account"}
        disabled={disabled}
        style={{ minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.xs }}
      >
        {({ pressed }) => <Text style={[typography.bodyMdMedium, { color: pressed ? colors.accentPressed : colors.accent }]}>{isSignup ? "Sign in" : "Create account"}</Text>}
      </PressableScale>
    </View>
  );
}
