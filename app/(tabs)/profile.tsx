import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Card from "../../components/ui/Card";
import { useAuth } from "../../src/auth/AuthContext";
import {
  getUserProfile,
  updateUserProfile,
  UserProfile,
} from "../../src/db/profiles";
import { syncWeightQueue } from "../../src/db/syncQueue";
import { useTheme } from "../../src/theme/theme";
import { createPageLogger } from "../../src/utils/logger";

const log = createPageLogger("Profile");

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

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [height, setHeight] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  /* =========================
     LOAD PROFILE
     ========================= */
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getUserProfile(user.uid);
        setProfile(data);
        setDisplayName(data?.displayName || "");
        setHeight(data?.height ? String(data.height) : "");
        log.info(`Loaded profile for ${user.uid}`);
      } catch (error) {
        log.error(`Failed to load profile: ${error}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  /* =========================
     PULL-TO-REFRESH
     ========================= */
  const handleRefresh = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      log.info("Pull-to-refresh triggered");
      const data = await getUserProfile(user.uid);
      setProfile(data);
      setDisplayName(data?.displayName || "");
      setHeight(data?.height ? String(data.height) : "");
      log.success("Profile refreshed");
    } catch (error) {
      log.error(`Failed to refresh profile: ${error}`);
    } finally {
      setRefreshing(false);
    }
  };

  /* =========================
     SYNC WEIGHTS
     ========================= */
  const handleSync = async () => {
    if (!user) {
      setSyncMessage("Not logged in");
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);
    log.info("Manual sync triggered from Profile");

    try {
      const result = await syncWeightQueue(user.uid);

      if (result.success) {
        log.success(
          "Sync completed",
          `Synced: ${result.synced}, Failed: ${result.failed}, Pending: ${result.pendingCount}`,
        );
        setSyncMessage(`Synced ${result.synced} records ✓`);
      } else if (result.failed > 0) {
        log.warn("Sync partial", `${result.failed} records failed to sync`);
        setSyncMessage(`Synced ${result.synced}, Failed: ${result.failed}`);
      } else {
        setSyncMessage("All up to date!");
      }
    } catch (error) {
      log.error(`Sync failed: ${error}`);
      setSyncMessage(
        `Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  /* =========================
     DETECT CHANGES
     ========================= */
  useEffect(() => {
    if (!profile) return;

    const nameChanged = displayName !== (profile.displayName || "");
    const heightChanged =
      height !== (profile.height ? String(profile.height) : "");

    setHasChanges(nameChanged || heightChanged);
  }, [displayName, height, profile]);

  /* =========================
     SAVE PROFILE
     ========================= */
  const handleSaveProfile = async () => {
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      const updates: any = {};

      if (displayName !== (profile.displayName || "")) {
        updates.displayName = displayName || null;
      }

      if (height && height !== String(profile.height || "")) {
        updates.height = parseFloat(height) || null;
      } else if (!height && profile.height) {
        updates.height = null;
      }

      await updateUserProfile(user.uid, updates);
      setProfile({ ...profile, ...updates });
      setHasChanges(false);

      log.success("Profile saved successfully");
      Alert.alert("Success", "Profile updated");
    } catch (error) {
      log.error(`Failed to save profile: ${error}`);
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  /* =========================
     LOGOUT
     ========================= */
  const handleLogout = async () => {
    Alert.alert("Log Out?", "Are you sure you want to log out?", [
      {
        text: "Cancel",
        onPress: () => {},
      },
      {
        text: "Log Out",
        onPress: async () => {
          try {
            await logout();
            log.info("User logged out");
          } catch (error) {
            log.error(`Logout failed: ${error}`);
            Alert.alert("Error", "Failed to log out");
          }
        },
        style: "destructive",
      },
    ]);
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: SPACING.md }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* HEADER WITH GEAR ICON */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: SPACING.lg,
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: colors.textPrimary,
          }}
        >
          Profile
        </Text>

        {/* SETTINGS GEAR ICON */}
        <Pressable
          onPress={() => setShowSettings(!showSettings)}
          style={{
            padding: SPACING.sm,
            borderRadius: RADIUS.md,
            backgroundColor: colors.card,
          }}
        >
          <Ionicons
            name={showSettings ? "close" : "settings"}
            size={24}
            color={colors.accent}
          />
        </Pressable>
      </View>

      {/* AVATAR PLACEHOLDER */}
      <View
        style={{
          alignItems: "center",
          marginBottom: SPACING.lg,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: SPACING.md,
          }}
        >
          <Ionicons
            name="person-circle-outline"
            size={60}
            color={colors.textPrimary}
          />
        </View>

        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: colors.textPrimary,
          }}
        >
          {displayName || "No name set"}
        </Text>
      </View>

      {/* EDITABLE FIELDS */}
      <Card style={{ marginBottom: SPACING.lg }}>
        {/* DISPLAY NAME */}
        <View style={{ marginBottom: SPACING.md }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textSecondary,
              marginBottom: SPACING.sm,
            }}
          >
            Display Name
          </Text>
          <TextInput
            placeholder="Enter your name"
            placeholderTextColor={colors.textSecondary}
            value={displayName}
            onChangeText={setDisplayName}
            style={{
              padding: SPACING.sm,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.textPrimary,
              fontSize: 16,
            }}
          />
        </View>

        {/* EMAIL (READ-ONLY) */}
        <View style={{ marginBottom: SPACING.md }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textSecondary,
              marginBottom: SPACING.sm,
            }}
          >
            Email
          </Text>
          <View
            style={{
              padding: SPACING.sm,
              borderRadius: RADIUS.md,
              backgroundColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
              {profile?.email || "Not set"}
            </Text>
          </View>
        </View>

        {/* HEIGHT */}
        <View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textSecondary,
              marginBottom: SPACING.sm,
            }}
          >
            Height (cm) - Optional
          </Text>
          <TextInput
            placeholder="Enter height in cm"
            placeholderTextColor={colors.textSecondary}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            style={{
              padding: SPACING.sm,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.textPrimary,
              fontSize: 16,
            }}
          />
        </View>
      </Card>

      {/* SAVE BUTTON */}
      {hasChanges && (
        <Pressable
          onPress={handleSaveProfile}
          disabled={isSaving}
          style={{
            backgroundColor: colors.accent,
            padding: SPACING.md,
            borderRadius: RADIUS.md,
            alignItems: "center",
            marginBottom: SPACING.lg,
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "600",
                fontSize: 16,
              }}
            >
              Save Changes
            </Text>
          )}
        </Pressable>
      )}

      {/* ACCOUNT INFO */}
      <Card style={{ marginBottom: SPACING.lg }}>
        <View style={{ marginBottom: SPACING.md }}>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginBottom: SPACING.sm,
            }}
          >
            USER ID
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textPrimary,
              fontFamily: "monospace",
            }}
          >
            {user?.uid || "Not logged in"}
          </Text>
        </View>

        <View style={{ marginBottom: SPACING.md }}>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginBottom: SPACING.sm,
            }}
          >
            CREATED
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textPrimary,
            }}
          >
            {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString()
              : "N/A"}
          </Text>
        </View>

        <View>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginBottom: SPACING.sm,
            }}
          >
            LAST UPDATED
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textPrimary,
            }}
          >
            {profile?.updatedAt
              ? new Date(profile.updatedAt).toLocaleDateString()
              : "N/A"}
          </Text>
        </View>
      </Card>

      {/* SETTINGS SECTION (toggleable) */}
      {showSettings && (
        <Card
          style={{
            marginBottom: SPACING.lg,
            borderColor: colors.accent,
            borderWidth: 1,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: colors.textPrimary,
              marginBottom: SPACING.md,
            }}
          >
            Settings
          </Text>

          {/* SYNC SECTION */}
          <View style={{ marginBottom: SPACING.lg }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textSecondary,
                marginBottom: SPACING.sm,
              }}
            >
              Data Sync
            </Text>
            <Pressable
              onPress={handleSync}
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
                    size={18}
                    color={colors.textPrimary}
                    style={{ marginRight: SPACING.sm }}
                  />
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontWeight: "600",
                      fontSize: 14,
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
                  color: syncMessage.includes("failed") ? "#ff6b6b" : "#51cf66",
                  marginTop: SPACING.md,
                  fontWeight: "500",
                  fontSize: 12,
                }}
              >
                {syncMessage}
              </Text>
            )}
          </View>

          {/* LOGOUT SECTION */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: SPACING.md,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textSecondary,
                marginBottom: SPACING.md,
              }}
            >
              Account
            </Text>
            <Pressable
              onPress={handleLogout}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ff6b6b",
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.lg,
                borderRadius: RADIUS.md,
              }}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color="white"
                style={{ marginRight: SPACING.sm }}
              />
              <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>
                Log Out
              </Text>
            </Pressable>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}
