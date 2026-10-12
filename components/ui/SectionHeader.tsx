import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { spacing, touchTarget, typography, semibold } from "../../theme/tokens";

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, actionLabel, onAction, actionAccessibilityLabel, style }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: touchTarget },
        style,
      ]}
    >
      <Text accessibilityRole="header" style={[typography.headlineMd, { color: colors.text, flexShrink: 1 }]}>
        {title}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          style={({ pressed }) => ({
            minHeight: touchTarget,
            minWidth: touchTarget,
            paddingHorizontal: spacing.sm,
            justifyContent: "center",
            alignItems: "flex-end",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={[typography.bodyMd, { color: colors.accent, ...semibold }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default SectionHeader;
