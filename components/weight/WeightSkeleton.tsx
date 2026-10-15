import { View } from "react-native";
import { SkeletonBlock } from "../ui/Skeleton";
import { size, spacing } from "../../theme/tokens";

export function WeightSkeleton() {
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel="Loading weight">
      <SkeletonBlock height={size.goalCard} radius="xl" />
      <SkeletonBlock height={size.goalCard * 3} radius="xl" />
      <SkeletonBlock height={size.trendChart + size.goalCard / 2} radius="xl" />
    </View>
  );
}
