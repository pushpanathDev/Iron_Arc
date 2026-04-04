import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuth } from "../../auth/AuthContext";
import { isAdminUser } from "../../firebase/admin";
import { SyncBadge, SyncState } from "../../components/SyncBadge";
import { ProfileCompletionPrompt } from "../../components/ProfileCompletionPrompt";
import { EmailVerificationPrompt } from "../../components/EmailVerificationPrompt";
import { useGlobalSync } from "../../context/SyncContext";
import {
  getUserProfile,
  updateUserProfile,
  syncProfileToFirebase,
  UserProfile,
} from "../../db/profiles";
import {
  getSyncStatus,
  getWorkoutSyncStatus,
  syncAllData,
} from "../../db/syncQueue";
import { getAllWeights } from "../../db/weights";
import {
  clearEmailVerificationStart,
  getEmailVerificationStart,
  setEmailVerificationStart,
} from "../../db/syncMeta";
import { useTheme } from "../../theme/theme";
import { formatAccountDate, getAvatarUrl } from "../../utils/avatar";
import { exportToCSV, exportToPDF } from "../../utils/exportData";
import { createPageLogger } from "../../utils/logger";
import { verificationMessages } from "../../constants/verificationMessages";
import {
  cancelTestNotification,
  scheduleTestNotificationEvery10Minutes,
} from "../../notifications/notificationService";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const log = createPageLogger("Profile");

export default function ProfileScreen() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { user, logout, isSyncing: isAuthSyncing } = useAuth();
  const { startSync, endSync } = useGlobalSync();
  const insets = useSafeAreaInsets();

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [profilePromptMode, setProfilePromptMode] = useState<"missing" | "age">("missing");
  const [verificationDaysLeft, setVerificationDaysLeft] = useState<number | null>(null);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [dismissVerificationBanner, setDismissVerificationBanner] = useState(false);

  const verificationGraceDays = 7;

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
  const loadProfile = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const [data, weights, weightStatus, workoutStatus] = await Promise.all([
        getUserProfile(user.uid),
        getAllWeights(user.uid),
        getSyncStatus(user.uid),
        getWorkoutSyncStatus(user.uid),
      ]);

      if (!isMounted.current) return;

      setProfile(data);
      setDisplayName(data?.displayName || "");
      setHeight(data?.height ? String(data.height) : "");
      setWeeklyGoal(data?.weeklyGoal ? String(data.weeklyGoal) : "1");

      const newestWeight = weights.length > 0 ? weights[0].weight : null;
      setLatestWeight(newestWeight);

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
  }, [user]);

  const loadVerificationStatus = useCallback(async () => {
    if (!user) return;
    try {
      await user.reload();
    } catch (reloadError) {
      // Non-blocking: keep last known status
    }

    if (user.emailVerified) {
      setVerificationDaysLeft(null);
      setDismissVerificationBanner(false);
      await clearEmailVerificationStart(user.uid);
      return;
    }

    let start = await getEmailVerificationStart(user.uid);
    if (!start) {
      start = Date.now();
      await setEmailVerificationStart(user.uid, start);
    }

    const elapsedDays = Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000));
    const daysLeft = Math.max(0, verificationGraceDays - elapsedDays);
    setVerificationDaysLeft(daysLeft);
  }, [user]);

  useEffect(() => {
    if (!user || user.emailVerified) return;
    if (verificationDaysLeft === 0 && !showVerificationPrompt) {
      setShowVerificationPrompt(true);
    }
  }, [user, verificationDaysLeft, showVerificationPrompt]);

  useEffect(() => {
    loadProfile();
    loadVerificationStatus();
  }, [loadProfile, loadVerificationStatus]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadVerificationStatus();
    }, [loadProfile, loadVerificationStatus]),
  );

  useEffect(() => {
    let active = true;
    const checkAdmin = async () => {
      if (!user?.email) {
        if (active) {
          setIsAdmin(false);
          setAdminChecked(true);
        }
        return;
      }
      const allowed = await isAdminUser(user.email);
      if (active) {
        setIsAdmin(allowed);
        setAdminChecked(true);
      }
    };
    checkAdmin();
    return () => {
      active = false;
    };
  }, [user?.email]);

  // Check if profile completion data is needed
  useEffect(() => {
    if (profile && !isLoading) {
      // Only show completion prompt if BOTH weight AND age are missing
      // If user has filled either one, show them in the profile instead
      const needsCompletion = !profile.weight && !latestWeight && !profile.age;
      setShowProfileCompletion(needsCompletion);
      
      // Debug log
      if (needsCompletion) {
        log.info("Profile completion needed: missing both weight and age");
      } else {
        log.info(`Profile complete - weight: ${profile.weight}, age: ${profile.age}`);
      }
    }
  }, [profile, latestWeight, isLoading]);

  /* =========================
     PULL-TO-REFRESH
     ========================= */
  const handleRefresh = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      log.info("Pull-to-refresh triggered");
      const [data, weights, weightStatus, workoutStatus] = await Promise.all([
        getUserProfile(user.uid),
        getAllWeights(user.uid),
        getSyncStatus(user.uid),
        getWorkoutSyncStatus(user.uid),
      ]);

      setProfile(data);
      setDisplayName(data?.displayName || "");
      setHeight(data?.height ? String(data.height) : "");
      setWeeklyGoal(data?.weeklyGoal ? String(data.weeklyGoal) : "1");

      const newestWeight = weights.length > 0 ? weights[0].weight : null;
      setLatestWeight(newestWeight);

      setPendingSync(weightStatus.pendingCount + workoutStatus.pendingCount);

      await loadVerificationStatus();

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

      // Save to SQLite
      await updateUserProfile(user.uid, updates);
      setProfile({ ...profile, ...updates });
      setHasChanges(false);

      // ✅ IMMEDIATELY SYNC TO FIREBASE
      console.log("📤 Syncing profile to Firebase immediately...");
      await syncProfileToFirebase({
        userId: user.uid,
        ...updates,
      });
      console.log("✅ Profile synced to Firebase");

      log.success("Profile saved and synced to Firebase");
      Alert.alert("Success", "Profile updated");
    } catch (error) {
      log.error(`Failed to save profile: ${error}`);
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  /* =========================
     PROFILE COMPLETION
     ========================= */
  const handleProfileCompletion = async (
    weight: number | null,
    age: number | null
  ) => {
    if (!user || !profile) return;

    try {
      const updates: any = {};

      if (weight !== null && weight !== profile.weight) {
        updates.weight = weight;
      }

      if (age !== null && age !== profile.age) {
        updates.age = age;
      }

      if (Object.keys(updates).length > 0) {
        // Save to SQLite
        await updateUserProfile(user.uid, updates);
        setProfile({ ...profile, ...updates });

        // ✅ IMMEDIATELY SYNC TO FIREBASE
        console.log("📤 Syncing profile completion to Firebase immediately...");
        await syncProfileToFirebase({
          userId: user.uid,
          ...updates,
        });
        console.log("✅ Profile completion synced to Firebase");
      }

      setShowProfileCompletion(false);
      log.success("Profile completion data saved and synced to Firebase");
    } catch (error) {
      log.error(`Failed to save profile completion: ${error}`);
      throw error;
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 12}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
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

      {/* Email Verification Banner */}
      {user &&
        !user.emailVerified &&
        verificationDaysLeft !== null &&
        !dismissVerificationBanner && (
        <Animated.View
          entering={FadeInDown.delay(120).duration(400)}
          style={{ marginBottom: spacing.lg }}
        >
          <View
            style={{
              backgroundColor:
                verificationDaysLeft > 0 ? colors.warning + "15" : colors.error + "15",
              borderRadius: radius.lg,
              padding: spacing.md,
              borderLeftWidth: 4,
              borderLeftColor:
                verificationDaysLeft > 0 ? colors.warning : colors.error,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text
                  style={{
                    ...typography.caption,
                    color: verificationDaysLeft > 0 ? colors.warning : colors.error,
                    marginBottom: spacing.xs,
                    fontWeight: "600",
                  }}
                >
                  {verificationDaysLeft > 0
                    ? verificationMessages.bannerTitleSoft(verificationDaysLeft)
                    : verificationMessages.bannerTitleHard}
                </Text>
                <Text style={{ ...typography.body, color: colors.textPrimary }}>
                  {verificationMessages.bannerBody}
                </Text>
                <Pressable
                  onPress={() => setShowVerificationPrompt(true)}
                  style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}
                >
                  <Text style={{ color: colors.accent, fontWeight: "600" }}>
                    {verificationMessages.bannerAction}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => setDismissVerificationBanner(true)}
                style={{ paddingLeft: spacing.sm }}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

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
          {user?.emailVerified ? (
            <View
              style={{
                marginLeft: spacing.xs,
                backgroundColor: colors.success + "20",
                borderRadius: radius.full,
                paddingHorizontal: spacing.xs,
                paddingVertical: 2,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xxs,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={12}
                color={colors.success}
              />
              <Text style={{ ...typography.label, color: colors.success }}>
                {verificationMessages.badgeVerified}
              </Text>
            </View>
          ) : (
            <View
              style={{
                marginLeft: spacing.xs,
                backgroundColor: colors.warning + "20",
                borderRadius: radius.full,
                paddingHorizontal: spacing.xs,
                paddingVertical: 2,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xxs,
              }}
            >
              <Ionicons name="alert-circle" size={12} color={colors.warning} />
              <Text style={{ ...typography.label, color: colors.warning }}>
                {verificationMessages.badgeUnverified}
              </Text>
            </View>
          )}
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

      {/* Legacy Profile Completion (missing age/weight) */}
      {(!profile?.age || (!profile?.weight && !latestWeight)) && (
        <Animated.View
          entering={FadeInUp.delay(170).duration(400)}
          style={{ marginBottom: spacing.lg }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <Text
              style={{
                ...typography.bodyMedium,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}
            >
              Complete your profile
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Add your age and weight so your insights are accurate.
            </Text>
            <Pressable
              onPress={() => {
                setProfilePromptMode("missing");
                setShowProfileCompletion(true);
              }}
              style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}
            >
              <Text style={{ color: colors.accent, fontWeight: "600" }}>
                Add missing details
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

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
            Display Name (Optional)
          </Text>
          <TextInput
            placeholder="Your name (set during onboarding)"
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
            Height (cm)
          </Text>
          <TextInput
            placeholder="Your height"
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

        {/* Weight */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Weight (kg)
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            }}
          >
            <Text style={{ ...typography.body, color: colors.textPrimary }}>
              {latestWeight ? `${latestWeight} kg` : profile?.weight ? `${profile.weight} kg` : "Not set"}
            </Text>
            <Pressable
              onPress={() => router.push("/body-weight")}
              style={{ marginLeft: "auto", paddingVertical: spacing.md }}
            >
              <Text style={{ color: colors.accent, fontWeight: "600" }}>
                Log
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Age */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Age
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            }}
          >
            <Text style={{ ...typography.body, color: colors.textPrimary }}>
              {profile?.age ? `${profile.age} years` : "Not set"}
            </Text>
            <Pressable
              onPress={() => {
                setProfilePromptMode("age");
                setShowProfileCompletion(true);
              }}
              style={{ marginLeft: "auto", paddingVertical: spacing.md }}
            >
              <Text style={{ color: colors.accent, fontWeight: "600" }}>
                Edit
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Daily Goal */}
        <View
          style={{
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.md,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.lg,
          }}
        >
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.md,
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Daily Workout Goal
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <Pressable
                key={num}
                onPress={() => setWeeklyGoal(String(num))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor:
                    weeklyGoal === String(num)
                      ? colors.accent
                      : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: weeklyGoal === String(num) ? 0 : 1,
                  borderColor: colors.cardBorder,
                }}
              >
                <Text
                  style={{
                    color:
                      weeklyGoal === String(num) ? "#fff" : colors.textPrimary,
                    fontWeight: weeklyGoal === String(num) ? "600" : "500",
                    fontSize: 14,
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
              fontSize: 12,
              fontStyle: "italic",
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

      {/* ACCOUNT INFO - Hidden for cleaner profile
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
      */}

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

      {__DEV__ && (
        <Animated.View
          entering={FadeInUp.delay(425).duration(400)}
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
            DEV: NOTIFICATIONS
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              onPress={async () => {
                await scheduleTestNotificationEvery10Minutes();
                Alert.alert(
                  "Test Scheduled",
                  "A test notification will fire every 10 minutes. Close the app and wait.",
                );
              }}
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
              <Ionicons
                name="time-outline"
                size={18}
                color={colors.textPrimary}
                style={{ marginRight: spacing.xs }}
              />
              <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
                Start 10-Min Test
              </Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                await cancelTestNotification();
                Alert.alert("Test Cancelled", "Test notifications stopped.");
              }}
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
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={colors.textPrimary}
                style={{ marginRight: spacing.xs }}
              />
              <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
                Stop Test
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

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

      {/* ADMIN TOOLS */}
      {adminChecked && isAdmin && (
        <Animated.View
          entering={FadeInUp.delay(520).duration(400)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.cardBorder,
            ...shadows.sm,
            marginBottom: spacing.md,
          }}
        >
          <Pressable
            onPress={() => router.push("/admin-catalog")}
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
                backgroundColor: colors.accentLight,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm,
              }}
            >
              <Ionicons name="settings-outline" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...typography.bodyMedium,
                  color: colors.textPrimary,
                }}
              >
                Admin: Exercise Catalog
              </Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Manage remote additions and removals
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      )}

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
          Version {Constants.expoConfig?.version || "1.1.1"}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          Designed & Built by Pushpanath
        </Text>
      </Animated.View>
      </ScrollView>

      {/* Profile Completion Prompt */}
      <ProfileCompletionPrompt
        visible={showProfileCompletion}
        onDismiss={() => setShowProfileCompletion(false)}
        onSave={handleProfileCompletion}
        currentWeight={profile?.weight}
        currentAge={profile?.age}
        isLoading={isSaving}
        allowWeightEdit={profilePromptMode === "missing"}
      />

      <EmailVerificationPrompt
        visible={showVerificationPrompt}
        user={user}
        dismissible={verificationDaysLeft !== 0}
        onSkip={() => setShowVerificationPrompt(false)}
        onVerified={async () => {
          setShowVerificationPrompt(false);
          if (user) {
            await clearEmailVerificationStart(user.uid);
          }
          await loadVerificationStatus();
        }}
      />
    </KeyboardAvoidingView>
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
