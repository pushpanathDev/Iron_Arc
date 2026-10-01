import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../theme/theme";

export type SyncBadgeProps = {
  state: "synced" | "syncing" | "error" | "pending";
  pendingCount?: number;
  compact?: boolean;
};

/**
 * Sync status badge component
 * Shows the current sync state with optional pending count
 */
export function SyncBadge({
  state,
  pendingCount = 0,
  compact = false,
}: SyncBadgeProps) {
  const { colors, spacing, radius, typography } = useTheme();

  // Determine colors and text based on state
  const getStateConfig = () => {
    switch (state) {
      case "synced":
        return {
          bg: colors.success + "20", // 20% opacity
          text: colors.success,
          label: "Synced",
        };
      case "syncing":
        return {
          bg: colors.info + "20",
          text: colors.info,
          label: "Syncing...",
        };
      case "error":
        return {
          bg: colors.error + "20",
          text: colors.error,
          label: "Sync Error",
        };
      case "pending":
        return {
          bg: colors.warning + "20",
          text: colors.warning,
          label: pendingCount ? `${pendingCount} pending` : "Pending",
        };
      default:
        return {
          bg: colors.neutral + "20",
          text: colors.neutral,
          label: "Unknown",
        };
    }
  };

  const config = getStateConfig();

  return (
    <View
      style={{
        backgroundColor: config.bg,
        paddingVertical: compact ? spacing.xs : spacing.sm,
        paddingHorizontal: compact ? spacing.sm : spacing.md,
        borderRadius: radius.full,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      {/* Status indicator dot */}
      <View
        style={{
          width: compact ? 6 : 8,
          height: compact ? 6 : 8,
          borderRadius: compact ? 3 : 4,
          backgroundColor: config.text,
        }}
      />
      <Text
        style={{
          ...(compact ? typography.caption : typography.body),
          color: config.text,
          fontWeight: "600",
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}
