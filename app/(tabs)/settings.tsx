import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Card from "../../components/ui/Card";
import { UserHeader } from "../../components/UserHeader";
import { useAuth } from "../../src/auth/AuthContext";
import { syncWeightQueue } from "../../src/db/syncQueue";
import { useTheme } from "../../src/theme/theme";
import { createPageLogger } from "../../src/utils/logger";

const log = createPageLogger("Settings");

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
};

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleGlobalSync = async () => {
    if (!user) {
      setSyncMessage("Not logged in");
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);
    log.info("Global sync initiated from Settings");

    try {
      // Sync weights
      const weightResult = await syncWeightQueue(user.uid);

      const totalSynced = weightResult.synced || 0;
      const totalFailed = weightResult.failed || 0;

      if (totalSynced > 0 || totalFailed > 0) {
        setSyncMessage(
          `Synced ${totalSynced} records${totalFailed > 0 ? `, ${totalFailed} failed` : ""} ✓`,
        );
        log.success(
          `Sync complete: ${totalSynced} synced, ${totalFailed} failed`,
        );
      } else {
        setSyncMessage("All up to date!");
      }
    } catch (error) {
      log.error(`Global sync failed: ${error}`);
      setSyncMessage(
        `Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: SPACING.md }}
    >
      {/* HEADER */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: SPACING.lg,
        }}
      >
        Settings
      </Text>

      {/* Show logged-in user */}
      <UserHeader variant="subtle" />

      {/* SYNC SECTION */}
      <Card>
        <View style={{ marginBottom: SPACING.md }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.textPrimary,
              marginBottom: SPACING.sm,
            }}
          >
            Sync Data
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: SPACING.md,
            }}
          >
            Manually sync weights with Firebase
          </Text>
        </View>

        <Pressable
          onPress={handleGlobalSync}
          disabled={isSyncing}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accent,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.lg,
            borderRadius: RADIUS.md,
            opacity: isSyncing ? 0.6 : 1,
          }}
        >
          {isSyncing ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <>
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={colors.textPrimary}
                style={{ marginRight: SPACING.sm }}
              />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                Sync Now
              </Text>
            </>
          )}
        </Pressable>

        {syncMessage && (
          <Text
            style={{
              textAlign: "center",
              color: syncMessage.includes("failed")
                ? "#ff6b6b" // red
                : "#51cf66", // green
              marginTop: SPACING.md,
              fontWeight: "500",
            }}
          >
            {syncMessage}
          </Text>
        )}
      </Card>

      {/* APP INFO SECTION */}
      <Card style={{ marginTop: SPACING.lg }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: colors.textPrimary,
            marginBottom: SPACING.md,
          }}
        >
          About
        </Text>

        <View style={{ marginBottom: SPACING.md }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            App Version
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "600",
              marginTop: SPACING.xs,
            }}
          >
            1.0.0
          </Text>
        </View>

        <View>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            Logged in as
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "600",
              marginTop: SPACING.xs,
            }}
          >
            {user?.email || "Not logged in"}
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}
