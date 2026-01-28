import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import Card from "../../components/ui/Card";
import { useAuth } from "../../src/auth/AuthContext";
import { useTheme } from "../../src/theme/theme";
import { formatDate, getWeekStart } from "../../src/utils/weekUtils";

import {
  BodyWeight,
  getAllWeights,
  insertWeight,
  softDeleteWeight,
} from "../../src/db/weights";

import { syncWeightQueue } from "../../src/db/syncQueue";
import { createPageLogger } from "../../src/utils/logger";

import * as Crypto from "expo-crypto";

const log = createPageLogger("BodyWeight");

export default function BodyWeightScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();

  const [weight, setWeight] = useState("");
  const [history, setHistory] = useState<BodyWeight[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const logDate = formatDate(selectedDate);
  const weekStart = getWeekStart(selectedDate);

  /* =========================
     LOAD SQLITE
     ========================= */
  const loadWeights = useCallback(async () => {
    if (!user) return;

    const data = await getAllWeights(user.uid);

    // Latest first
    const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));

    setHistory(sorted);

    // Find entry for selected date (allow daily updates)
    const existingEntry = sorted.find((w) => w.date === logDate);
    setWeight(existingEntry ? String(existingEntry.weight) : "");
  }, [user, logDate]);

  useEffect(() => {
    loadWeights();
  }, [loadWeights]);

  /* =========================
     PULL-TO-REFRESH SYNC
     ========================= */
  const handleRefresh = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      log.info("Pull-to-refresh triggered");
      const result = await syncWeightQueue(user.uid);

      if (result.success) {
        log.success(
          "Sync completed",
          `Synced: ${result.synced}, Failed: ${result.failed}, Pending: ${result.pendingCount}`,
        );
        setMessage(`Synced ${result.synced} records ✓`);
      } else if (result.failed > 0) {
        log.warn("Sync partial", `${result.failed} records failed to sync`);
        setMessage(`Synced ${result.synced}, Failed: ${result.failed}`);
      }

      // Reload data after sync
      await loadWeights();
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
  /* =========================
     SAVE / UPDATE
     ========================= */
  async function saveWeight() {
    if (!user || !weight) {
      setMessage("Please enter weight");
      return;
    }

    // Allow multiple entries per week (daily flexibility)
    // Just add/update entry for this date
    const newWeight: BodyWeight = {
      id: `${user.uid}_${logDate}`, // Use date as part of ID
      userId: user.uid,
      date: logDate, // Actual date user picked
      weekStart: formatDate(weekStart), // For grouping in analytics
      weight: Number(weight),
      createdAt: Date.now(),
      isSynced: 0, // Mark as unsynced - will sync on app focus
    };

    await insertWeight(newWeight);

    setMessage("Weight saved ✓ (syncing...)");
    loadWeights();
    log.success("Weight saved", `${weight}kg on ${logDate}`);

    setTimeout(() => setMessage(null), 1500);
  }

  /* =========================
     DELETE
     ========================= */
  async function deleteWeight(item: BodyWeight) {
    if (!user) return;

    // Soft delete (will be synced later)
    await softDeleteWeight(item.id);

    setMessage("Weight deleted ✓ (syncing...)");
    loadWeights();
    log.success("Weight deleted", item.id);

    setTimeout(() => setMessage(null), 1500);
  }

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

  /* =========================
     UI
     ========================= */
  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.md,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accent}
          title="Pull to sync weights..."
          titleColor={colors.textSecondary}
        />
      }
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: spacing.md,
        }}
      >
        Body Weight Tracker
      </Text>

      {/* INPUT */}
      <Card>
        <TextInput
          placeholder="Weight (kg)"
          placeholderTextColor={colors.textSecondary}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.textPrimary,
            marginBottom: spacing.md,
          }}
        />
      </Card>

      {/* DATE PICKER (Allow daily updates) */}
      <Pressable
        onPress={() => setShowDatePicker(true)}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          backgroundColor: colors.card,
          padding: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.md,
        }}
      >
        <View>
          <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
            {logDate}
          </Text>
          <Text
            style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}
          >
            Week of {formatDate(weekStart)}
          </Text>
        </View>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, date) => {
            setShowDatePicker(false);
            if (!date) return;
            // Allow any past date
            setSelectedDate(date);
            log.info(`Date selected: ${formatDate(date)}`);
          }}
        />
      )}

      {message && (
        <Text style={{ textAlign: "center", color: colors.textSecondary }}>
          {message}
        </Text>
      )}

      <Pressable
        onPress={saveWeight}
        style={{
          backgroundColor: colors.accent,
          padding: spacing.md,
          borderRadius: radius.md,
          alignItems: "center",
          marginBottom: spacing.lg,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Save / Update</Text>
      </Pressable>

      {/* HISTORY */}
      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          color: colors.textPrimary,
          marginBottom: spacing.sm,
        }}
      >
        History
      </Text>

      {history.map((item, index) => {
        const prev = history[index + 1];
        const diff = prev ? item.weight - prev.weight : 0;

        return (
          <Card key={item.id}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.textPrimary }}>
                {item.date}: {item.weight} kg{" "}
                {prev && (
                  <Text>
                    {diff > 0 ? "↑" : diff < 0 ? "↓" : "→"}{" "}
                    {Math.abs(diff).toFixed(1)} kg
                  </Text>
                )}
              </Text>

              <Pressable onPress={() => deleteWeight(item)}>
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}
