import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuth } from "../../auth/AuthContext";
import { SyncBadge, SyncState } from "../../components/SyncBadge";
import { useGlobalSync } from "../../context/SyncContext";
import {
  getUserProfile,
  updateUserProfile,
  UserProfile,
} from "../../db/profiles";
import {
  getSyncStatus,
  getWorkoutSyncStatus,
  syncAllData,
} from "../../db/syncQueue";
import { useTheme } from "../../theme/theme";
import { formatAccountDate, getAvatarUrl } from "../../utils/avatar";
import { exportToCSV, exportToPDF } from "../../utils/exportData";
import { createPageLogger } from "../../utils/logger";

const log = createPageLogger("Profile");

export default function ProfileScreen() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { user, logout, isSyncing: isAuthSyncing } = useAuth();
  const { startSync, endSync } = useGlobalSync();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [height, setHeight] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState("1");
  const [hasChanges, setHasChanges] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [isExporting, setIsExporting] = useState(false);

  // Guard flag to prevent operations when component is unmounting
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
        if (!isMounted.current) return;

        setProfile(data);
        setDisplayName(data?.displayName || "");
        setHeight(data?.height ? String(data.height) : "");
        setWeeklyGoal(data?.weeklyGoal ? String(data.weeklyGoal) : "1");

        // Get pending sync count and update sync state
        const [weightStatus, workoutStatus] = await Promise.all([
          getSyncStatus(user.uid),
          getWorkoutSyncStatus(user.uid),
        ]);

        if (!isMounted.current) return;

        const total = weightStatus.pendingCount + workoutStatus.pendingCount;
        setPendingSync(total);
        setSyncState(total > 0 ? "pending" : "synced");

        log.info(`Loaded profile for ${user.uid}`);
      } catch (error) {
        log.error(`Failed to load profile: ${error}`);
        if (isMounted.current) setSyncState("failed");
      } finally {
        if (isMounted.current) setIsLoading(false);
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
      setWeeklyGoal(data?.weeklyGoal ? String(data.weeklyGoal) : "1");

      // Update pending sync count
      const [weightStatus, workoutStatus] = await Promise.all([
        getSyncStatus(user.uid),
        getWorkoutSyncStatus(user.uid),
      ]);
      setPendingSync(weightStatus.pendingCount + workoutStatus.pendingCount);

      log.success("Profile refreshed");
    } catch (error) {
      log.error(`Failed to refresh profile: ${error}`);
    } finally {
      setRefreshing(false);
    }
  };

  /* =========================
     SYNC ALL DATA (Weights + Workouts)
     ========================= */
  const handleSync = async () => {
    if (!user || isSyncing) {
      if (!user) setSyncMessage("Not logged in");
      return;
    }

    setIsSyncing(true);
    setSyncState("syncing");
    setSyncMessage(null);
    startSync("Syncing..."); // Show global floating loader
    log.info("Manual sync triggered from Profile");

    try {
      // Reset failed records to allow retry after code fixes
      const result = await syncAllData(user.uid, true);

      if (!isMounted.current) return;

      const totalSynced = result.weights.synced + result.workouts.synced;
      const totalFailed = result.weights.failed + result.workouts.failed;
      const bothSuccess = result.weights.success && result.workouts.success;

      if (bothSuccess && totalSynced > 0) {
        log.success(
          "Sync completed",
          `Weights: ${result.weights.synced}, Workouts: ${result.workouts.synced}`,
        );
        setSyncMessage(`Synced ${totalSynced} records ✓`);
        setPendingSync(0);
        setSyncState("synced");
      } else if (totalFailed > 0) {
        log.warn("Sync partial", `${totalFailed} records failed to sync`);
        setSyncMessage(`Synced ${totalSynced}, Failed: ${totalFailed}`);
        setSyncState("failed");
      } else {
        setSyncMessage("All up to date!");
        setPendingSync(0);
        setSyncState("synced");
      }
    } catch (error) {
      log.error(`Sync failed: ${error}`);
      if (isMounted.current) {
        setSyncMessage(
          `Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        setSyncState("failed");
      }
    } finally {
      endSync(); // Hide global floating loader
      if (isMounted.current) {
        setIsSyncing(false);
        setTimeout(() => setSyncMessage(null), 3000);
      }
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
    const goalChanged =
      weeklyGoal !== (profile.weeklyGoal ? String(profile.weeklyGoal) : "1");

    setHasChanges(nameChanged || heightChanged || goalChanged);
  }, [displayName, height, weeklyGoal, profile]);

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

      // Daily goal update (ensure it's between 1-10)
      const goalNum = parseInt(weeklyGoal) || 1;
      if (goalNum !== (profile.weeklyGoal || 1)) {
        updates.weeklyGoal = Math.max(1, Math.min(10, goalNum));
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
    // Check network connectivity first
    const networkState = await NetInfo.fetch();
    const isOnline =
      networkState.isConnected && networkState.isInternetReachable;

    // Also check if there's pending data to sync
    let hasPendingData = false;
    if (user) {
      try {
        const [weightStatus, workoutStatus] = await Promise.all([
          getSyncStatus(user.uid),
          getWorkoutSyncStatus(user.uid),
        ]);
        hasPendingData =
          weightStatus.pendingCount + workoutStatus.pendingCount > 0;
      } catch (e) {
        // If we can't check, assume there might be pending data
        hasPendingData = true;
      }
    }

    if (!isOnline && hasPendingData) {
      // OFFLINE with pending data - WARN about data loss
      Alert.alert(
        "⚠️ You're Offline",
        "You have unsynced data that will be LOST if you log out now.\n\nConnect to the internet and try again, or tap 'Log Out Anyway' to continue (data will be lost).",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Log Out Anyway",
            style: "destructive",
            onPress: async () => {
              try {
                log.warn("User logging out OFFLINE - data may be lost!");
                await logout();
                log.info("User logged out (offline - data may be lost)");
              } catch (error) {
                log.error(`Logout failed: ${error}`);
                Alert.alert("Error", "Failed to log out. Please try again.");
              }
            },
          },
        ],
      );
    } else if (!isOnline && !hasPendingData) {
      // OFFLINE but no pending data - safe to logout
      Alert.alert(
        "Log Out?",
        "You're offline, but all your data is already synced. Safe to log out!",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Log Out",
            style: "destructive",
            onPress: async () => {
              try {
                await logout();
                log.info("User logged out (offline, no pending data)");
              } catch (error) {
                log.error(`Logout failed: ${error}`);
                Alert.alert("Error", "Failed to log out. Please try again.");
              }
            },
          },
        ],
      );
    } else {
      // ONLINE - normal flow with auto-sync
      Alert.alert(
        "Log Out?",
        "Your data will be automatically synced to the cloud before logging out.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Log Out",
            style: "destructive",
            onPress: async () => {
              try {
                await logout();
                log.info("User logged out (with auto-sync)");
              } catch (error) {
                log.error(`Logout failed: ${error}`);
                Alert.alert("Error", "Failed to log out. Please try again.");
              }
            },
          },
        ],
      );
    }
  };

  /* =========================
     EXPORT DATA
     ========================= */
  const handleExport = (format: "csv" | "pdf") => {
    Alert.alert(
      `Export as ${format.toUpperCase()}`,
      `This will export all your workouts and body weight records as a ${format.toUpperCase()} file.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export",
          onPress: async () => {
            if (!user) {
              Alert.alert("Error", "You must be logged in to export data.");
              return;
            }

            setIsExporting(true);
            try {
              log.info(`Starting ${format.toUpperCase()} export...`);

              if (format === "csv") {
                await exportToCSV(user.uid);
              } else {
                await exportToPDF(user.uid);
              }

              log.success(`${format.toUpperCase()} export completed`);
            } catch (error) {
              log.error(`Export failed: ${error}`);
              Alert.alert(
                "Export Failed",
                error instanceof Error
                  ? error.message
                  : "An unknown error occurred",
              );
            } finally {
              setIsExporting(false);
            }
          },
        },
      ],
    );
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
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.xxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* HEADER */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              onPress={() => router.back()}
              style={{ marginRight: spacing.sm }}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.textPrimary}
              />
            </Pressable>
            <Text style={{ ...typography.h1, color: colors.textPrimary }}>
              Profile
            </Text>
          </View>
          {/* Sync Status Badge in Header */}
          <SyncBadge
            state={syncState}
            pendingCount={pendingSync}
            compact
            onPress={handleSync}
          />
        </View>
        <Text
          style={{
            ...typography.body,
            color: colors.textSecondary,
            marginBottom: spacing.lg,
          }}
        >
          Manage your account
        </Text>
      </Animated.View>

      {/* AVATAR & NAME HERO */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(400)}
        style={{
          alignItems: "center",
          marginBottom: spacing.xl,
        }}
      >
        {/* Avatar - Generated or from Google */}
        <View
          style={{
            borderRadius: radius.full,
            marginBottom: spacing.md,
            ...shadows.lg,
          }}
        >
          <Image
            source={{
              uri: getAvatarUrl({
                avatarUrl: profile?.avatarUrl,
                displayName: displayName || profile?.displayName,
                email: profile?.email || user?.email,
                userId: user?.uid || "default",
              }),
            }}
            style={{
              width: 100,
              height: 100,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceElevated,
            }}
          />
          {/* Auth provider badge */}
          {profile?.authProvider === "google" && (
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                backgroundColor: colors.surface,
                borderRadius: radius.full,
                padding: 4,
                ...shadows.sm,
              }}
            >
              <Ionicons name="logo-google" size={18} color="#4285F4" />
            </View>
          )}
        </View>

        <Text
          style={{
            ...typography.h2,
            color: colors.textPrimary,
            marginBottom: spacing.xxs,
          }}
        >
          {displayName || "Set your name"}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            {profile?.email || user?.email || "No email"}
          </Text>
          {profile?.authProvider === "google" && (
            <View
              style={{
                marginLeft: spacing.xs,
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.xs,
                paddingVertical: 2,
              }}
            >
              <Text style={{ ...typography.label, color: colors.textMuted }}>
                Google
              </Text>
            </View>
          )}
        </View>

        {/* Account created date */}
        <Text
          style={{
            ...typography.caption,
            color: colors.textMuted,
            marginTop: spacing.xs,
          }}
        >
          Member since {formatAccountDate(profile?.createdAt)}
        </Text>
      </Animated.View>

      {/* PROFILE FIELDS */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.lg,
          }}
        >
          PERSONAL INFO
        </Text>

        {/* Display Name */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Display Name
          </Text>
          <TextInput
            placeholder="Enter your name"
            placeholderTextColor={colors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: typography.body.fontSize,
            }}
          />
        </View>

        {/* Height */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Height (cm) - Optional
          </Text>
          <TextInput
            placeholder="Enter height"
            placeholderTextColor={colors.textMuted}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: typography.body.fontSize,
            }}
          />
        </View>

        {/* Daily Goal */}
        <View>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Daily Workout Goal
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: spacing.xs,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <Pressable
                key={num}
                onPress={() => setWeeklyGoal(String(num))}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: radius.md,
                  backgroundColor:
                    weeklyGoal === String(num)
                      ? colors.accent
                      : colors.surfaceElevated,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color:
                      weeklyGoal === String(num) ? "#fff" : colors.textPrimary,
                    fontWeight: weeklyGoal === String(num) ? "600" : "400",
                    fontSize: num === 10 ? 10 : 12,
                  }}
                >
                  {num}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text
            style={{
              ...typography.caption,
              color: colors.textMuted,
              marginTop: spacing.xs,
            }}
          >
            How many workouts do you aim to complete each day?
          </Text>
        </View>
      </Animated.View>

      {/* SAVE BUTTON */}
      {hasChanges && (
        <Animated.View entering={FadeInUp.duration(300)}>
          <Pressable
            onPress={handleSaveProfile}
            disabled={isSaving}
            style={{
              backgroundColor: colors.accent,
              padding: spacing.md,
              borderRadius: radius.lg,
              alignItems: "center",
              marginBottom: spacing.md,
              opacity: isSaving ? 0.6 : 1,
              ...shadows.md,
            }}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Save Changes
              </Text>
            )}
          </Pressable>
        </Animated.View>
      )}

      {/* ACCOUNT INFO */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.lg,
          }}
        >
          ACCOUNT
        </Text>

        <InfoRow
          label="User ID"
          value={user?.uid?.slice(0, 16) + "..."}
          colors={colors}
          spacing={spacing}
          typography={typography}
        />
        <View
          style={{
            height: 1,
            backgroundColor: colors.divider,
            marginVertical: spacing.md,
          }}
        />
        <InfoRow
          label="Member Since"
          value={
            profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString()
              : "N/A"
          }
          colors={colors}
          spacing={spacing}
          typography={typography}
        />
        <View
          style={{
            height: 1,
            backgroundColor: colors.divider,
            marginVertical: spacing.md,
          }}
        />
        <InfoRow
          label="Last Updated"
          value={
            profile?.updatedAt
              ? new Date(profile.updatedAt).toLocaleDateString()
              : "N/A"
          }
          colors={colors}
          spacing={spacing}
          typography={typography}
        />
      </Animated.View>

      {/* SETTINGS SECTION - Always visible at bottom */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.lg,
          }}
        >
          DATA & SYNC
        </Text>

        {/* Sync Status */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor:
                  pendingSync > 0 ? colors.warningLight : colors.successLight,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm,
              }}
            >
              <Ionicons
                name={
                  pendingSync > 0 ? "cloud-upload-outline" : "checkmark-circle"
                }
                size={20}
                color={pendingSync > 0 ? colors.warning : colors.success}
              />
            </View>
            <View>
              <Text
                style={{ ...typography.bodyMedium, color: colors.textPrimary }}
              >
                {pendingSync > 0 ? `${pendingSync} pending` : "All synced"}
              </Text>
              <Text
                style={{ ...typography.caption, color: colors.textSecondary }}
              >
                {pendingSync > 0 ? "Tap to sync now" : "Data is up to date"}
              </Text>
            </View>
          </View>
        </View>

        {/* Sync Button */}
        <Pressable
          onPress={handleSync}
          disabled={isSyncing}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accent,
            padding: spacing.md,
            borderRadius: radius.lg,
            opacity: isSyncing ? 0.6 : 1,
          }}
        >
          {isSyncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name="sync-outline"
                size={20}
                color="#fff"
                style={{ marginRight: spacing.xs }}
              />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
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
                ? colors.error
                : colors.success,
              marginTop: spacing.md,
              fontWeight: "500",
              fontSize: 14,
            }}
          >
            {syncMessage}
          </Text>
        )}
      </Animated.View>

      {/* EXPORT DATA SECTION */}
      <Animated.View
        entering={FadeInUp.delay(450).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
          opacity: isExporting ? 0.7 : 1,
        }}
      >
        <View style={{ padding: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: colors.accentLight,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm,
              }}
            >
              <Ionicons
                name="download-outline"
                size={20}
                color={colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ ...typography.bodyMedium, color: colors.textPrimary }}
              >
                Export Data
              </Text>
              <Text
                style={{ ...typography.caption, color: colors.textSecondary }}
              >
                Download your workout history
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              onPress={() => handleExport("csv")}
              disabled={isExporting}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surfaceElevated,
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={colors.textPrimary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text
                    style={{
                      ...typography.bodyMedium,
                      color: colors.textPrimary,
                    }}
                  >
                    CSV
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => handleExport("pdf")}
              disabled={isExporting}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surfaceElevated,
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Ionicons
                    name="document-outline"
                    size={18}
                    color={colors.textPrimary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text
                    style={{
                      ...typography.bodyMedium,
                      color: colors.textPrimary,
                    }}
                  >
                    PDF
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* LOGOUT SECTION */}
      <Animated.View
        entering={FadeInUp.delay(550).duration(400)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
          opacity: isAuthSyncing ? 0.7 : 1,
        }}
      >
        <Pressable
          onPress={handleLogout}
          disabled={isAuthSyncing}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: isAuthSyncing
                ? colors.surfaceElevated
                : colors.errorLight,
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.sm,
            }}
          >
            {isAuthSyncing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...typography.bodyMedium,
                color: isAuthSyncing ? colors.textSecondary : colors.error,
              }}
            >
              {isAuthSyncing ? "Syncing data..." : "Log Out"}
            </Text>
            <Text
              style={{ ...typography.caption, color: colors.textSecondary }}
            >
              {isAuthSyncing
                ? "Please wait while your data is saved"
                : "Sign out of your account"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </Animated.View>

      {/* APP INFO / CREDITS */}
      <Animated.View
        entering={FadeInUp.delay(600).duration(400)}
        style={{
          alignItems: "center",
          marginTop: spacing.xl,
          paddingBottom: spacing.lg,
        }}
      >
        <Image
          source={require("../../assets/images/icon.png")}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            marginBottom: spacing.sm,
          }}
        />
        <Text
          style={{
            ...typography.bodyMedium,
            color: colors.textPrimary,
            marginBottom: spacing.xxs,
          }}
        >
          Iron Arc
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: spacing.xs,
          }}
        >
          Version {Constants.expoConfig?.version || "1.0.0"}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          Designed & Built by Pushpanath
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

/* =========================
   HELPER COMPONENTS
   ========================= */

function InfoRow({
  label,
  value,
  colors,
  spacing,
  typography,
}: {
  label: string;
  value: string;
  colors: any;
  spacing: any;
  typography: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
        {label}
      </Text>
      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}
