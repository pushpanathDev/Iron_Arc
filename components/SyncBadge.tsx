import React from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/theme";

export type SyncState = "synced" | "pending" | "syncing" | "failed";

interface SyncBadgeProps {
  state: SyncState;
  pendingCount?: number;
  compact?: boolean;
  onPress?: () => void;
}

/**
 * Sync status badge component
 * Shows current sync state with icon and optional count
 */
export function SyncBadge({ state, pendingCount = 0, compact = false, onPress }: SyncBadgeProps) {
  const { colors, spacing, radius, typography } = useTheme();
  
  // Animation for syncing state
  const rotation = useSharedValue(0);
  
  React.useEffect(() => {
    if (state === "syncing") {
      rotation.value = withRepeat(withTiming(360, { duration: 1000 }), -1, false);
    } else {
      rotation.value = 0;
    }
  }, [state]);
  
  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const getConfig = () => {
    switch (state) {
      case "synced":
        return {
          icon: "cloud-done-outline" as const,
          color: colors.success,
          bgColor: colors.successLight,
          text: "Synced",
        };
      case "pending":
        return {
          icon: "cloud-upload-outline" as const,
          color: colors.warning,
          bgColor: colors.warningLight,
          text: pendingCount > 0 ? `${pendingCount} pending` : "Pending",
        };
      case "syncing":
        return {
          icon: "sync" as const,
          color: colors.accent,
          bgColor: colors.accentLight,
          text: "Syncing...",
        };
      case "failed":
        return {
          icon: "cloud-offline-outline" as const,
          color: colors.error,
          bgColor: colors.errorLight,
          text: "Sync failed",
        };
    }
  };

  const config = getConfig();

  if (compact) {
    // Small badge for headers
    const Container = onPress ? Pressable : View;
    return (
      <Container
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: config.bgColor,
          paddingVertical: spacing.xxs,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.lg,
        }}
      >
        <Animated.View style={state === "syncing" ? animatedIconStyle : undefined}>
          <Ionicons name={config.icon} size={14} color={config.color} />
        </Animated.View>
        {pendingCount > 0 && state === "pending" && (
          <Text style={{ 
            fontSize: 11, 
            fontWeight: "600", 
            color: config.color, 
            marginLeft: 4 
          }}>
            {pendingCount}
          </Text>
        )}
      </Container>
    );
  }

  // Full badge with text
  const Container = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: config.bgColor,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.lg,
      }}
    >
      <Animated.View style={state === "syncing" ? animatedIconStyle : undefined}>
        <Ionicons name={config.icon} size={16} color={config.color} />
      </Animated.View>
      <Text style={{ 
        ...typography.caption, 
        color: config.color, 
        marginLeft: spacing.xs,
        fontWeight: "500",
      }}>
        {config.text}
      </Text>
    </Container>
  );
}

/**
 * Loading overlay for blocking operations
 * Note: Hooks are called unconditionally to maintain hook order
 */
export function LoadingOverlay({ visible, message }: { visible: boolean; message?: string }) {
  const { colors, spacing, radius, typography } = useTheme();
  
  // Always render but conditionally show - maintains hook order
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        // Hide when not visible
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          padding: spacing.xl,
          borderRadius: radius.xl,
          alignItems: "center",
          minWidth: 150,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
        {message && (
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md }}>
            {message}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
