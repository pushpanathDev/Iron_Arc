import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Polyline,
  Stop,
  LinearGradient as SvgGradient,
} from "react-native-svg";

import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../theme/theme";
import { formatDate, getWeekStart } from "../../utils/weekUtils";

import {
  BodyWeight,
  getAllWeights,
  insertWeight,
  softDeleteWeight,
} from "../../db/weights";
import { updateUserProfile } from "../../db/profiles";

import { SyncState } from "../../components/SyncBadge";
import { WeightScale } from "../../components/WeightScale";
import { useGlobalSync } from "../../context/SyncContext";
import { createPageLogger } from "../../utils/logger";

import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const log = createPageLogger("BodyWeight");
const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = -60;
const DELETE_WIDTH = 80;

/* =========================
   LONG PRESS BUTTON (for hold-to-increment)
   ========================= */
interface LongPressButtonProps {
  onIncrement: () => void;
  children: React.ReactNode;
  style?: any;
  initialDelay?: number;
  repeatInterval?: number;
}

function LongPressButton({
  onIncrement,
  children,
  style,
  initialDelay = 300, // Slower start for better control
  repeatInterval = 80,
}: LongPressButtonProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPressingRef = useRef(false);
  const pressCountRef = useRef(0);

  const scheduleNext = useCallback(
    (delay: number) => {
      // Guard: ensure only one timer runs at a time
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        // Guard: check if still pressing before executing
        if (!isPressingRef.current) {
          timerRef.current = null;
          return;
        }

        onIncrement();
        pressCountRef.current++;

        // Progressive acceleration: gradually reduce delay
        // Start at initialDelay, reduce by 3ms per increment, floor at repeatInterval
        const accelerationFactor = Math.max(
          0,
          initialDelay - pressCountRef.current * 3,
        );
        const nextDelay = Math.max(repeatInterval, accelerationFactor);

        scheduleNext(nextDelay);
      }, delay);
    },
    [onIncrement, initialDelay, repeatInterval],
  );

  const start = useCallback(() => {
    // Guard: prevent stacking multiple presses
    if (isPressingRef.current) {
      return;
    }

    isPressingRef.current = true;
    pressCountRef.current = 0;

    // Call immediately on first press
    onIncrement();
    pressCountRef.current++;

    // Schedule first repeat after initialDelay
    scheduleNext(initialDelay);
  }, [onIncrement, scheduleNext, initialDelay]);

  const stop = useCallback(() => {
    isPressingRef.current = false;

    // Immediately clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    pressCountRef.current = 0;
  }, []);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      onLongPress={() => {}} // Required for proper button feedback on some Android devices
      style={style}
    >
      {children}
    </Pressable>
  );
}

export default function BodyWeightScreen() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { user } = useAuth();
  const { globalSync, refreshVersion, startSync, endSync } = useGlobalSync();
  const insets = useSafeAreaInsets();

  const [weight, setWeight] = useState("");
  const [history, setHistory] = useState<BodyWeight[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletedWeight, setDeletedWeight] = useState<BodyWeight | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [isSaving, setIsSaving] = useState(false);

  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logDate = formatDate(selectedDate);
  const weekStart = getWeekStart(selectedDate);

  /* =========================
     LOAD SQLITE
     ========================= */
  const loadWeights = useCallback(async () => {
    if (!user?.uid) {
      setHistory([]);
      setWeight("");
      return;
    }

    try {
      const data = await getAllWeights(user.uid);
      // Latest first
      const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
      setHistory(sorted);

      // Find entry for selected date (allow daily updates)
      const existingEntry = sorted.find((w) => w.date === logDate);
      setWeight(existingEntry ? String(existingEntry.weight) : "");
    } catch (error) {
      console.error("Failed to load weights:", error);
      setMessage("Failed to load weights");
      setHistory([]);
    }
  }, [user?.uid, logDate]);

  useEffect(() => {
    loadWeights();
  }, [loadWeights]);

  /* =========================
     PULL-TO-REFRESH (GLOBAL SYNC)
     ========================= */
  const handleRefresh = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      log.info("Pull-to-refresh triggered");

      // Trigger global sync - pushes local changes THEN pulls from Firebase
      await globalSync(user.uid);

      // Reload data after sync
      await loadWeights();
      setMessage("Synced ✓");
      log.success("Body weight synced via global sync");
    } catch (error) {
      log.error(
        "Refresh sync failed",
        error instanceof Error ? error.message : String(error),
      );
      setMessage("Sync failed - check your connection");
    } finally {
      setRefreshing(false);
      setTimeout(() => setMessage(null), 2000);
    }
  };

  // Refresh when global sync happens on another screen
  useEffect(() => {
    if (!user || refreshVersion === 0) return;
    loadWeights();
  }, [refreshVersion]);
  /* =========================
     SAVE / UPDATE
     ========================= */
  async function saveWeight() {
    if (!user?.uid || !weight) {
      setMessage("Please enter weight");
      return;
    }

    // Guard against double saves
    if (isSaving || refreshing) {
      setMessage("Please wait...");
      return;
    }

    setIsSaving(true);
    setSyncState("syncing");

    try {
      const weightValue = parseFloat(weight);
      if (isNaN(weightValue) || weightValue <= 0) {
        setMessage("Please enter a valid weight");
        setSyncState("failed");
        return;
      }

      // Allow multiple entries per week (daily flexibility)
      // Just add/update entry for this date
      const newWeight: BodyWeight = {
        id: `${user.uid}_${logDate}`, // Use date as part of ID
        userId: user.uid,
        date: logDate, // Actual date user picked
        weekStart: formatDate(weekStart), // For grouping in analytics
        weight: weightValue,
        createdAt: Date.now(),
        isSynced: 0, // Mark as unsynced - will sync on app focus
      };

      await insertWeight(newWeight);

      // Keep profile weight in sync with the latest entry
      try {
        await updateUserProfile(user.uid, { weight: weightValue });
      } catch (profileError) {
        console.warn("Failed to update profile weight:", profileError);
      }

      setMessage("Weight saved ✓ (syncing...)");
      loadWeights();
      log.success("Weight saved", `${weight}kg on ${logDate}`);
      setSyncState("pending");

      setTimeout(() => setMessage(null), 1500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error("Save failed", errorMsg);
      setMessage(`Failed to save weight: ${errorMsg}`);
      setSyncState("failed");
    } finally {
      setIsSaving(false);
    }
  }

  /* =========================
     DELETE WITH UNDO
     ========================= */
  async function deleteWeight(item: BodyWeight) {
    if (!user?.uid) {
      setMessage("User not authenticated");
      return;
    }

    // Guard against delete while syncing/refreshing
    if (refreshing || isSaving) {
      setMessage("Please wait until sync completes");
      return;
    }

    // Store for undo
    setDeletedWeight(item);

    // Remove from UI immediately
    setHistory((prev) => prev.filter((w) => w.id !== item.id));

    // Soft delete (will be synced later)
    await softDeleteWeight(item.id);
    log.success("Weight deleted", item.id);

    // Start undo timer (5 seconds)
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setDeletedWeight(null);
    }, 5000);
  }

  const undoDelete = async () => {
    if (!deletedWeight || !user) return;

    // Re-insert the weight
    await insertWeight({
      ...deletedWeight,
      isDeleted: 0,
    });

    setDeletedWeight(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);

    loadWeights();
    log.info(`Undo delete ${deletedWeight.id}`);
  };

  /* =========================
     SAFE UUID
     ========================= */
  function generateId() {
    try {
      return Crypto.randomUUID();
    } catch {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  }

  // Calculate stats
  const currentWeight = history[0]?.weight || 0;
  const previousWeight = history[1]?.weight || currentWeight;
  const weightChange = currentWeight - previousWeight;
  const firstWeight = history[history.length - 1]?.weight || currentWeight;
  const totalChange = currentWeight - firstWeight;

  // Chart data (last 7 entries)
  const chartData = [...history].reverse().slice(-7);
  const chartWidth = SCREEN_WIDTH - spacing.md * 4;
  const chartHeight = 120;

  /* =========================
     UI
     ========================= */
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
        <Text
          style={{
            ...typography.h1,
            color: colors.textPrimary,
            marginBottom: spacing.xs,
          }}
        >
          Body Weight
        </Text>
        <Text
          style={{
            ...typography.body,
            color: colors.textSecondary,
            marginBottom: spacing.lg,
          }}
        >
          Track your progress • Pull to refresh
        </Text>
      </Animated.View>

      {/* HERO CARD - Current Weight */}
      <Animated.View entering={FadeInUp.delay(100).duration(400)}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={{
            borderRadius: radius.xl,
            padding: spacing.lg,
            marginBottom: spacing.md,
            ...shadows.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View>
              <Text
                style={{
                  ...typography.caption,
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: spacing.xs,
                }}
              >
                Current Weight
              </Text>
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text style={{ ...typography.display, color: "#fff" }}>
                  {currentWeight || "—"}
                </Text>
                <Text
                  style={{
                    ...typography.h3,
                    color: "rgba(255,255,255,0.8)",
                    marginLeft: spacing.xs,
                  }}
                >
                  kg
                </Text>
              </View>
            </View>

            {/* Change Indicator */}
            {history.length > 1 && (
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.lg,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name={
                    weightChange > 0
                      ? "arrow-up"
                      : weightChange < 0
                        ? "arrow-down"
                        : "remove"
                  }
                  size={14}
                  color="#fff"
                />
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: 14,
                    marginLeft: 4,
                  }}
                >
                  {Math.abs(weightChange).toFixed(1)} kg
                </Text>
              </View>
            )}
          </View>

          {/* Mini Stats */}
          <View
            style={{
              flexDirection: "row",
              marginTop: spacing.lg,
              gap: spacing.lg,
            }}
          >
            <View>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                Total Change
              </Text>
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                {totalChange > 0 ? "+" : ""}
                {totalChange.toFixed(1)} kg
              </Text>
            </View>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                Entries
              </Text>
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                {history.length}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* WEIGHT TREND CHART */}
      {chartData.length >= 2 && (
        <Animated.View
          entering={FadeInUp.delay(150).duration(400)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.md,
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
              marginBottom: spacing.md,
            }}
          >
            WEIGHT TREND
          </Text>
          <WeightChart
            data={chartData}
            width={chartWidth}
            height={chartHeight}
            colors={colors}
          />
        </Animated.View>
      )}

      {/* INPUT SECTION */}
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
            marginBottom: spacing.md,
          }}
        >
          LOG WEIGHT
        </Text>

        {/* Animated Weight Scale */}
        <View style={{ alignItems: "center", marginBottom: spacing.md }}>
          <WeightScale
            weight={parseFloat(weight) || 0}
            size={200}
            maxWeight={200}
            colors={colors}
          />
        </View>

        {/* Weight Input with +/- buttons */}
        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Enter Weight
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <LongPressButton
              onIncrement={() => {
                setWeight((prev) => {
                  const current = parseFloat(prev) || 0;
                  const next = Math.max(0, current - 0.5);
                  return next.toFixed(1);
                });
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceElevated,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="remove" size={24} color={colors.textSecondary} />
            </LongPressButton>
            <TextInput
              placeholder="0.0"
              placeholderTextColor={colors.textMuted}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: 24,
                fontWeight: "600",
                textAlign: weight ? "center" : "left",
              }}
            />
            <LongPressButton
              onIncrement={() => {
                setWeight((prev) => {
                  const current = parseFloat(prev) || 0;
                  // Safety bound: cap weight increments at 999.9kg
                  const next = Math.min(999.9, current + 0.5);
                  return next.toFixed(1);
                });
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.md,
                backgroundColor: colors.accentLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="add" size={24} color={colors.accent} />
            </LongPressButton>
            <Text style={{ ...typography.body, color: colors.textSecondary }}>
              kg
            </Text>
          </View>
        </View>

        {/* Date Picker */}
        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Date
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceElevated,
            }}
          >
            <View>
              <Text
                style={{ ...typography.bodyMedium, color: colors.textPrimary }}
              >
                {logDate}
              </Text>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                Week of {formatDate(weekStart)}
              </Text>
            </View>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: colors.accentLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.accent}
              />
            </View>
          </Pressable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (!date) return;
              setSelectedDate(date);
              log.info(`Date selected: ${formatDate(date)}`);
            }}
          />
        )}

        {/* Message */}
        {message && (
          <Text
            style={{
              textAlign: "center",
              color: message.includes("✓")
                ? colors.success
                : colors.textSecondary,
              marginBottom: spacing.md,
              fontWeight: "500",
            }}
          >
            {message}
          </Text>
        )}

        {/* Save Button */}
        <Pressable
          onPress={saveWeight}
          style={{
            backgroundColor: colors.accent,
            padding: spacing.md,
            borderRadius: radius.lg,
            alignItems: "center",
            ...shadows.md,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            Save Weight
          </Text>
        </Pressable>
      </Animated.View>

      {/* HISTORY */}
      <Animated.View entering={FadeInUp.delay(300).duration(400)}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.md,
            marginTop: spacing.sm,
          }}
        >
          <Text style={{ ...typography.label, color: colors.textMuted }}>
            HISTORY
          </Text>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>
            Swipe left to delete
          </Text>
        </View>

        {history.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xl,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <Ionicons name="scale-outline" size={40} color={colors.textMuted} />
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                marginTop: spacing.sm,
              }}
            >
              No entries yet
            </Text>
          </View>
        ) : (
          history.map((item, index) => (
            <WeightSwipeRow
              key={item.id}
              item={item}
              prevItem={history[index + 1]}
              onDelete={() => deleteWeight(item)}
              index={index}
              disabled={refreshing || isSaving}
            />
          ))
        )}
      </Animated.View>

      {/* UNDO TOAST */}
      {deletedWeight && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={{
            position: "absolute",
            bottom: spacing.xxl,
            left: spacing.md,
            right: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            ...shadows.lg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
          }}
        >
          <Text style={{ ...typography.body, color: colors.textPrimary }}>
            Weight deleted
          </Text>
          <Pressable
            onPress={undoDelete}
            style={{
              backgroundColor: colors.accent,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.lg,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Undo</Text>
          </Pressable>
        </Animated.View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* =========================
   SWIPE ROW COMPONENT
   ========================= */
function WeightSwipeRow({
  item,
  prevItem,
  onDelete,
  index,
  disabled = false,
}: {
  item: BodyWeight;
  prevItem?: BodyWeight;
  onDelete: () => void;
  index: number;
  disabled?: boolean;
}) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const translateX = useSharedValue(0);

  const diff = prevItem ? item.weight - prevItem.weight : 0;

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => {
      translateX.value = Math.min(0, e.translationX);
    })
    .onEnd(() => {
      if (translateX.value < SWIPE_THRESHOLD) {
        translateX.value = withTiming(-DELETE_WIDTH);
      } else {
        translateX.value = withTiming(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(350 + index * 30).duration(300)}
      style={{
        marginBottom: spacing.sm,
        borderRadius: radius.xl,
        overflow: "hidden",
      }}
    >
      {/* DELETE ACTION */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: DELETE_WIDTH,
          backgroundColor: colors.error,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Pressable onPress={onDelete} style={{ padding: spacing.md }}>
          <Ionicons name="trash" size={22} color="#FFF" />
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            animatedStyle,
            {
              backgroundColor: colors.surface,
              padding: spacing.md,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              flexDirection: "row",
              alignItems: "center",
              ...shadows.sm,
            },
          ]}
        >
          {/* Date */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.lg,
              backgroundColor: colors.surfaceElevated,
              justifyContent: "center",
              alignItems: "center",
              marginRight: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colors.textPrimary,
              }}
            >
              {new Date(item.date).getDate()}
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: colors.textMuted,
                textTransform: "uppercase",
              }}
            >
              {new Date(item.date).toLocaleDateString("en", { month: "short" })}
            </Text>
          </View>

          {/* Weight */}
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.h3, color: colors.textPrimary }}>
              {item.weight} kg
            </Text>
            {prevItem && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name={
                    diff > 0 ? "arrow-up" : diff < 0 ? "arrow-down" : "remove"
                  }
                  size={12}
                  color={
                    diff > 0
                      ? colors.error
                      : diff < 0
                        ? colors.success
                        : colors.textMuted
                  }
                />
                <Text
                  style={{
                    ...typography.caption,
                    color:
                      diff > 0
                        ? colors.error
                        : diff < 0
                          ? colors.success
                          : colors.textMuted,
                    marginLeft: 2,
                  }}
                >
                  {Math.abs(diff).toFixed(1)} kg
                </Text>
              </View>
            )}
          </View>

          {/* Chevron hint */}
          <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/* =========================
   WEIGHT CHART COMPONENT
   ========================= */
function WeightChart({
  data,
  width,
  height,
  colors,
}: {
  data: BodyWeight[];
  width: number;
  height: number;
  colors: any;
}) {
  if (data.length < 2) return null;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(data.length - 1);
  }, [data.length]);

  const weights = data.map((d) => d.weight);
  const minWeight = Math.min(...weights) - 1;
  const maxWeight = Math.max(...weights) + 1;
  const range = maxWeight - minWeight || 1;

  const xStep = width / (data.length - 1);
  const points = data.map((d, i) => ({
    x: i * xStep,
    y: height - ((d.weight - minWeight) / range) * height,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  const selected =
    selectedIndex !== null ? data[selectedIndex] : null;
  const selectedPoint =
    selectedIndex !== null ? points[selectedIndex] : null;

  const tooltipWidth = 100;
  const tooltipX = selectedPoint
    ? Math.max(
        4,
        Math.min(selectedPoint.x - tooltipWidth / 2, width - tooltipWidth - 4),
      )
    : 0;
  const tooltipY = selectedPoint
    ? Math.max(4, selectedPoint.y - 36)
    : 0;

  return (
    <View style={{ width, height: height + 24 }}>
      <Svg width={width} height={height + 20}>
        <Defs>
          <SvgGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.3" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="1" />
          </SvgGradient>
        </Defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((ratio, i) => (
          <Line
            key={i}
            x1={0}
            y1={height * ratio}
            x2={width}
            y2={height * ratio}
            stroke={colors.divider}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Line */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((p, i) => {
          const isSelected = i === selectedIndex;
          return (
            <G key={i}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={isSelected ? 6 : 4}
                fill={colors.accent}
                stroke={isSelected ? "#fff" : "transparent"}
                strokeWidth={isSelected ? 2 : 0}
              />
              {/* Touch target */}
              <Circle
                cx={p.x}
                cy={p.y}
                r={12}
                fill="transparent"
                onPress={() => setSelectedIndex(i)}
              />
            </G>
          );
        })}
      </Svg>

      {selected && selectedPoint && (
        <View
          style={{
            position: "absolute",
            left: tooltipX,
            top: tooltipY,
            backgroundColor: colors.surface,
            borderRadius: 8,
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderWidth: 1,
            borderColor: colors.cardBorder,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.textPrimary,
              textAlign: "center",
            }}
          >
            {selected.weight.toFixed(1)} kg
          </Text>
          <Text
            style={{
              fontSize: 10,
              color: colors.textMuted,
              textAlign: "center",
            }}
          >
            {selected.date}
          </Text>
        </View>
      )}
    </View>
  );
}
