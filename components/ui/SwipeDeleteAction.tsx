import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

/** The red "Delete" panel revealed by swiping a row left (ReanimatedSwipeable's renderRightActions). */
export function SwipeDeleteAction() {
  const { colors } = useTheme();
  return (
    <View style={{ width: size.iconBadge + spacing.xl, marginLeft: spacing.sm, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: spacing.xxs, backgroundColor: colors.dangerSubtle }}>
      <MaterialIcons name="delete-outline" size={size.iconLg} color={colors.danger} />
      <Text style={[typography.labelMd, { color: colors.danger }]}>Delete</Text>
    </View>
  );
}
