import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useConnection } from "../../context/ConnectionContext";
import { useTheme } from "../../theme/theme";
import { motion, size, spacing, typography } from "../../theme/tokens";

/**
 * Thin bar shown on tab screens while we're not connected but saved data is
 * on screen. Data refetches automatically once the connection returns.
 */
export function OfflineBanner() {
  const { colors } = useTheme();
  const { state, hasCachedData } = useConnection();
  const visible = state !== "online" && hasCachedData;

  const height = useSharedValue(0);
  useEffect(() => {
    height.value = withTiming(visible ? size.banner : 0, { duration: motion.slideMs });
  }, [visible, height]);
  const slide = useAnimatedStyle(() => ({ height: height.value }));

  const label =
    state === "offline"
      ? "Offline · showing saved data"
      : state === "waking"
        ? "Server waking up · showing saved data"
        : "Can't reach server · showing saved data";

  return (
    <Animated.View style={[{ overflow: "hidden", backgroundColor: colors.surfaceContainerHigh }, slide]}>
      <View
        accessible={visible}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${label}. Will refresh when back online.`}
        style={{
          height: size.banner,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
          paddingHorizontal: spacing.screen,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 }}>
          <MaterialIcons name="cloud-off" size={size.iconSm} color={colors.warning} />
          <Text style={[typography.labelSm, { color: colors.text }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={[typography.labelSm, { color: colors.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
          Will refresh when back online
        </Text>
      </View>
    </Animated.View>
  );
}

export default OfflineBanner;
