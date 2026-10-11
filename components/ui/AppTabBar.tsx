import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/theme";
import { elevation, spacing, touchTarget, typography } from "../../theme/tokens";

const LOG_SIZE = 56;
const BAR_HEIGHT = 64;

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export type AppTabBarProps = BottomTabBarProps & {
  onLogPress: () => void;
};

/**
 * Bottom tab bar with a centred Log button. Unmounts while the keyboard is
 * open so it never rides up over the keyboard on Android (adjustResize).
 */
export function AppTabBar({ state, descriptors, navigation, onLogPress }: AppTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

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
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        testID={options.tabBarButtonTestID}
        style={styles.tab}
      >
        {options.tabBarIcon?.({ focused, color, size: 24 })}
        <Text style={[typography.caption, { color, fontWeight: focused ? "600" : "500" }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const logButton = (
    <View key="__log" style={styles.tab}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onLogPress();
        }}
        accessibilityRole="button"
        accessibilityLabel="Log workout"
        style={({ pressed }) => [
          styles.logButton,
          { backgroundColor: pressed ? colors.accentPressed : colors.accent, borderColor: colors.bg },
          elevation.md,
        ]}
      >
        <Ionicons name="add" size={30} color={colors.onAccent} />
      </Pressable>
      <Text
        style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        Log
      </Text>
    </View>
  );

  const items = visibleRoutes.map(renderTab);
  items.splice(logIndex, 0, logButton);

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        minHeight: BAR_HEIGHT + insets.bottom,
        paddingBottom: Math.max(spacing.xs, insets.bottom),
        paddingTop: spacing.xxs,
        backgroundColor: colors.card,
        borderTopWidth: 1,
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
    minHeight: touchTarget + 4,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  logButton: {
    width: LOG_SIZE,
    height: LOG_SIZE,
    borderRadius: LOG_SIZE / 2,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
  },
});

export default AppTabBar;
