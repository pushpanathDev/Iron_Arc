import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { StyleSheet, Text, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/theme";
import { motion, radius, size, spacing, touchTarget, typography } from "../../theme/tokens";
import { PressableScale } from "./PressableScale";

export type AppTabBarProps = BottomTabBarProps & {
  onLogPress: () => void;
};

/**
 * Bottom tab bar with a centred Log button. Hidden while the keyboard is open
 * so it never rides up over the keyboard.
 */
export function AppTabBar({ state, descriptors, navigation, onLogPress }: AppTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);

  if (keyboardVisible) return null;

  const visibleRoutes = state.routes.filter(
    (route) => StyleSheet.flatten(descriptors[route.key].options.tabBarItemStyle)?.display !== "none",
  );
  const logIndex = Math.ceil(visibleRoutes.length / 2);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const { options } = descriptors[route.key];
    const focused = state.routes[state.index]?.key === route.key;
    const color = focused ? colors.accent : colors.textSecondary;
    const label = typeof options.title === "string" ? options.title : route.name;

    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        Haptics.selectionAsync().catch(() => {});
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <PressableScale
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        testID={options.tabBarButtonTestID}
        style={styles.tab}
      >
        {options.tabBarIcon?.({ focused, color, size: size.tabIcon })}
        <Text style={[typography.labelSm, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </PressableScale>
    );
  };

  const logButton = (
    <View key="__log" style={styles.tab}>
      <PressableScale
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onLogPress();
        }}
        pressedScale={motion.pressScaleStrong}
        accessibilityRole="button"
        accessibilityLabel="Log workout"
        hitSlop={(touchTarget - size.logButton) / 2}
        style={({ pressed }) => ({
          width: size.logButton,
          height: size.logButton,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
        })}
      >
        <Ionicons name="add" size={size.iconLg} color={colors.onAccent} />
      </PressableScale>
    </View>
  );

  const items = visibleRoutes.map(renderTab);
  items.splice(logIndex, 0, logButton);

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: size.tabBar + insets.bottom,
        paddingBottom: insets.bottom,
        paddingHorizontal: spacing.xs,
        backgroundColor: colors.card,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
      }}
    >
      {items}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    minWidth: size.tabMin,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
});

export default AppTabBar;
