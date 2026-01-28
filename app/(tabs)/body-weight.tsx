import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState, useCallback } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import Card from "../../components/ui/Card";
import { useTheme } from "../../src/theme/theme";
import {
  formatDate,
  getWeekStart,
  isFutureWeek,
} from "../../src/utils/weekUtils";
import { useAuth } from "../../src/auth/AuthContext";

import {
  BodyWeight,
  deleteWeightById,
  getAllWeights,
  insertWeight,
} from "../../src/db/weights";

import {
  syncWeightAdd,
  syncWeightDelete,
} from "../../src/firebase/weights";

import * as Crypto from "expo-crypto";

export default function BodyWeightScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();

  const [weight, setWeight] = useState("");
  const [history, setHistory] = useState<BodyWeight[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(getWeekStart(new Date()));
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const weekDate = formatDate(selectedWeek);

  /* =========================
     LOAD SQLITE
     ========================= */
  const loadWeights = useCallback(async () => {
    if (!user) return;

    const data = await getAllWeights(user.uid);

    // Latest first
    const sorted = [...data].sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    setHistory(sorted);

    const currentWeek = sorted.find((w) => w.date === weekDate);
    setWeight(currentWeek ? String(currentWeek.weight) : "");
  }, [user, weekDate]);

  useEffect(() => {
    loadWeights();
  }, [loadWeights]);

  /* =========================
     SAVE / UPDATE
     ========================= */
  async function saveWeight() {
    if (!user || !weight) {
      setMessage("Please enter weight");
      return;
    }

    // Enforce one weight per week
    const existing = history.find((w) => w.date === weekDate);

    if (existing) {
      await deleteWeightById(existing.id);
      syncWeightDelete(user.uid, existing.id);
    }

    const newWeight: BodyWeight = {
      id: generateId(),
      userId: user.uid,
      date: weekDate,
      weight: Number(weight),
      createdAt: Date.now(),
    };

    await insertWeight(newWeight);
    syncWeightAdd(user.uid, newWeight);

    setMessage("Weight saved ✓");
    loadWeights();

    setTimeout(() => setMessage(null), 1500);
  }

  /* =========================
     DELETE
     ========================= */
  async function deleteWeight(item: BodyWeight) {
    if (!user) return;

    await deleteWeightById(item.id);
    syncWeightDelete(user.uid, item.id);

    loadWeights();
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
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: spacing.md,
        }}
      >
        Weekly Body Weight
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

      {/* WEEK PICKER */}
      <Pressable
        onPress={() => setShowWeekPicker(true)}
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
        <Text style={{ color: colors.textPrimary }}>
          Week: {weekDate}
        </Text>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {showWeekPicker && (
        <DateTimePicker
          value={selectedWeek}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, date) => {
            setShowWeekPicker(false);
            if (!date) return;

            const weekStart = getWeekStart(date);
            if (isFutureWeek(weekStart)) {
              setMessage("Future weeks not allowed");
              return;
            }

            setSelectedWeek(weekStart);
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
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          Save / Update
        </Text>
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
