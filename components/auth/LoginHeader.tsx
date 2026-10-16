import { Image, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";

const APP_LOGO = require("../../assets/images/icon.png");

/** Logo, wordmark and a line that changes between sign in and create account. */
export function LoginHeader({ isSignup }: { isSignup: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
      <View style={{ width: size.logoTile, height: size.logoTile, borderRadius: radius.xl, backgroundColor: colors.raised, overflow: "hidden" }}>
        <Image
          source={APP_LOGO}
          style={{ width: size.logoTile, height: size.logoTile }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <Text
        accessibilityRole="header"
        accessibilityLabel="Iron Arc"
        style={[typography.headlineLg, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.wordmark, marginTop: spacing.lg, marginBottom: spacing.sm }]}
      >
        Iron Arc
      </Text>
      <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center", maxWidth: size.textNarrow }]}>
        {isSignup ? "Begin your training log.\nCreate your account." : "Welcome back \nSign in to your training log"}
      </Text>
    </View>
  );
}
