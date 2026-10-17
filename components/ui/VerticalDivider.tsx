import { View } from "react-native";
import { useTheme } from "../../theme/theme";
import { size, spacing } from "../../theme/tokens";

/** Thin upright line between side-by-side stats. */
export function VerticalDivider() {
  const { colors } = useTheme();
  return <View style={{ width: size.divider, marginVertical: spacing.md, backgroundColor: colors.border }} />;
}
