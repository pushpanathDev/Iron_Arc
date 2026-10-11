import React from "react";
import { Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { useTheme } from "../theme/theme";

interface UserHeaderProps {
  variant?: "subtle" | "prominent";
}

/**
 * Shows the currently logged-in user's name/email
 * Prevents confusion about whose data you're viewing
 * Note: All hooks run unconditionally to maintain hook order
 */
export function UserHeader({ variant = "subtle" }: UserHeaderProps) {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();

  if (!user) {
    return <View />;
  }

  const displayName = profile?.displayName || user.email || "User";

  if (variant === "prominent") {
    return (
      <View style={{ marginBottom: spacing.lg }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: colors.accent,
            marginBottom: spacing.xs,
          }}
        >
          👤 {displayName}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          {user.email}
        </Text>
      </View>
    );
  }

  // Subtle variant - just email/name in smaller text
  return (
    <Text
      style={{
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
      }}
    >
      Logged in as {displayName}
    </Text>
  );
}
