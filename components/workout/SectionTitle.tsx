import { memo } from "react";
import { Text, View } from "react-native";
import { HEADER_HEIGHT } from "./pickerList";
import { useTheme } from "../../theme/theme";
import { spacing, typography } from "../../theme/tokens";

export const SectionTitle = memo(function SectionTitle({ title, right }: { title: string; right?: string }) {
  const { colors } = useTheme();
  return (
    <View renderToHardwareTextureAndroid style={{ height: HEADER_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, backgroundColor: colors.bg }}>
      <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {right ? <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{right}</Text> : null}
    </View>
  );
});
