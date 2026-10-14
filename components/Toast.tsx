import { MaterialIcons } from "@expo/vector-icons";
import { type ComponentProps, useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";
import { elevation, motion, radius, size, spacing, touchTarget, typography } from "../theme/tokens";
import { PressableScale } from "./ui/PressableScale";

export type ToastType = "success" | "error" | "undo" | "info" | "warning";

export interface ToastConfig {
  /** Title line. */
  message: string;
  subtitle?: string;
  type?: ToastType;
  /** ms before auto-dismiss; 0 keeps it until dismissed. Defaults per type. */
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ComponentProps<typeof MaterialIcons>["name"];
}

interface ToastProps extends ToastConfig {
  onDismiss: () => void;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  undo: 5000,
  info: 4000,
  warning: 4000,
  error: 0,
};
const SWIPE_DISMISS = 40;
const OFFSCREEN = 160;

export function Toast({ message, subtitle, type = "info", duration, actionLabel, onAction, icon, onDismiss }: ToastProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(OFFSCREEN);
  const closing = useRef(false);
  const ms = duration ?? DEFAULT_DURATION[type];

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    translateY.value = withTiming(OFFSCREEN, { duration: motion.slideMs }, () => runOnJS(onDismiss)());
  }, [onDismiss, translateY]);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: motion.slideMs });
    AccessibilityInfo.announceForAccessibility(subtitle ? `${message}. ${subtitle}` : message);
    if (!ms) return;
    const timer = setTimeout(close, ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_DISMISS || e.velocityY > 500) {
        translateY.value = withTiming(OFFSCREEN, { duration: motion.slideMs }, () => runOnJS(onDismiss)());
      } else {
        translateY.value = withTiming(0, { duration: motion.slideMs });
      }
    });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const look = {
    success: { icon: "check-circle" as const, tint: colors.accent, bg: colors.surfaceContainerHigh, action: colors.accent },
    error: { icon: "error-outline" as const, tint: colors.danger, bg: colors.surfaceContainerHigh, action: colors.danger },
    undo: { icon: "delete-outline" as const, tint: colors.textSecondary, bg: colors.surfaceContainerHighest, action: colors.accent },
    info: { icon: "info-outline" as const, tint: colors.textSecondary, bg: colors.surfaceContainerHighest, action: colors.accent },
    warning: { icon: "warning-amber" as const, tint: colors.warning, bg: colors.surfaceContainerHigh, action: colors.warning },
  }[type];

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          {
            position: "absolute",
            left: spacing.screen,
            right: spacing.screen,
            bottom: insets.bottom + size.tabBar + spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingLeft: spacing.md,
            paddingRight: actionLabel || !ms ? spacing.xs : spacing.md,
            paddingVertical: spacing.sm,
            minHeight: touchTarget + spacing.sm * 2,
            borderRadius: radius.lg,
            backgroundColor: look.bg,
            zIndex: 9999,
          },
          elevation.md,
          slide,
        ]}
      >
        <View
          style={{
            width: size.toastIcon,
            height: size.toastIcon,
            borderRadius: radius.md,
            backgroundColor: type === "undo" || type === "info" ? colors.surfaceContainerHigh : colors.surfaceContainerHighest,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name={icon ?? look.icon} size={size.icon} color={look.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyMdMedium, { color: colors.text }]} numberOfLines={2}>
            {message}
          </Text>
          {subtitle && (
            <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
        {actionLabel && onAction && (
          <PressableScale
            onPress={() => {
              onAction();
              close();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel}: ${message}`}
            style={{ minHeight: touchTarget, minWidth: touchTarget, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={[typography.labelLg, { color: look.action }]}>{actionLabel}</Text>
          </PressableScale>
        )}
        {!ms && (
          <PressableScale
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{ width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }}
          >
            <MaterialIcons name="close" size={size.iconSm} color={colors.textSecondary} />
          </PressableScale>
        )}
      </Animated.View>
    </GestureDetector>
  );
}
