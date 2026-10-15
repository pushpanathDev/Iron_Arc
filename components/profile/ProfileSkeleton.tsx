import { View } from "react-native";
import { SkeletonBlock } from "../ui/Skeleton";
import { useTheme } from "../../theme/theme";
import { size, spacing } from "../../theme/tokens";

export function ProfileSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.screen, gap: spacing.xl }} accessibilityLabel="Loading profile">
      <SkeletonBlock height={size.appBar} radius="lg" />
      <SkeletonBlock height={size.goalCard * 1.8} radius="xl" />
      <SkeletonBlock height={size.exerciseRow * 4} radius="xl" />
      <SkeletonBlock height={size.exerciseRow * 3} radius="xl" />
    </View>
  );
}
