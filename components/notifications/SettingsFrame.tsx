import { MaterialIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { BackButton } from "../ui/IconButton";

/** Header (back, title, "Saved" badge) around the content. */
export function SettingsFrame({ insets, saved, children }: { insets: { top: number }; saved: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingLeft: spacing.xs, paddingRight: spacing.screen }}>
        <BackButton />
        <Text style={[typography.headlineMd, { flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
          Notifications
        </Text>
        {saved && (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.accentSubtle }}>
            <MaterialIcons name="check" size={size.iconXs} color={colors.accent} />
            <Text style={[typography.labelSm, { color: colors.accent }]}>Saved</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}
