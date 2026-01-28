import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import { getUserProfile, UserProfile } from "../src/db/profiles";
import { useTheme } from "../src/theme/theme";

interface UserHeaderProps {
  variant?: "subtle" | "prominent";
}

/**
 * Shows the currently logged-in user's name/email
 * Prevents confusion about whose data you're viewing
 */
export function UserHeader({ variant = "subtle" }: UserHeaderProps) {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const data = await getUserProfile(user.uid);
        setProfile(data);
      } catch (error) {
        console.warn("Failed to load profile for header:", error);
      }
    };

    loadProfile();
  }, [user]);

  if (!user) return null;

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
