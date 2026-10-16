import { memo } from "react";
import { Pressable, Text } from "react-native";
import { MuscleIcon } from "../muscle/MuscleIcon";
import type { MuscleGroup } from "../muscle/musclePaths";
import type { TileKey } from "../../data/pickerTiles";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

export const CategoryTile = memo(function CategoryTile({
  tileKey,
  label,
  group,
  active,
  onPress,
}: {
  tileKey: TileKey;
  label: string;
  group: MuscleGroup;
  active: boolean;
  onPress: (key: TileKey) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onPress(tileKey)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      accessibilityHint={active ? "Shows all exercises again" : `Shows ${label} exercises`}
      style={({ pressed }) => ({
        flex: 1,
        height: size.categoryTile,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        backgroundColor: active || pressed ? colors.surfaceContainerHigh : colors.raised,
      })}
    >
      <MuscleIcon group={group} size={size.muscleIcon} active={active} />
      <Text style={[typography.labelMd, { color: active ? colors.accent : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});
