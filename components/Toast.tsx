import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastProps extends ToastConfig {
  onDismiss: () => void;
}

const ICONS: Record<ToastType, string> = {
  success: "checkmark-circle",
  error: "alert-circle",
  warning: "warning",
  info: "information-circle",
};

export function Toast({
  message,
  type = "info",
  duration = 3500,
  onDismiss,
}: ToastProps) {
  const { colors, spacing, radius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;
  const dismissedRef = useRef(false);

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss();
  };

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after duration
    const hideTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => dismiss());
    }, duration);

    return () => clearTimeout(hideTimer);
  }, []);

  const bgColor =
    type === "success"
      ? colors.successLight
      : type === "error"
        ? colors.errorLight
        : type === "warning"
          ? colors.warningLight
          : colors.surfaceElevated;

  const textColor =
    type === "success"
      ? colors.success
      : type === "error"
        ? colors.error
        : type === "warning"
          ? colors.warning
          : colors.textPrimary;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          bottom: insets.bottom + 80,
          left: spacing.md,
          right: spacing.md,
          backgroundColor: bgColor,
          borderRadius: radius.xl,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: textColor + "30",
          zIndex: 9999,
          ...shadows.lg,
        },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Ionicons
        name={ICONS[type] as any}
        size={20}
        color={textColor}
        style={{ marginRight: spacing.sm }}
      />
      <Text
        style={{
          ...typography.body,
          color: textColor,
          flex: 1,
          fontWeight: "500",
        }}
        numberOfLines={2}
      >
        {message}
      </Text>
      <Pressable onPress={dismiss} style={{ marginLeft: spacing.sm, padding: 4 }}>
        <Ionicons name="close" size={16} color={textColor} />
      </Pressable>
    </Animated.View>
  );
}
