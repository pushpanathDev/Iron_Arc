import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput } from "react-native";

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
  getAllWeights,
  insertWeight,
} from "../../src/db/weights";
import { syncWeightAdd } from "../../src/firebase/weights";

export default function BodyWeightScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();

  const [weight, setWeight] = useState("");
  const [history, setHistory] = useState<BodyWeight[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(getWeekStart(new Date()));
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const weekDate = formatDate(selectedWeek);

  /* ---------------- LOAD FROM SQLITE ---------------- */
  const loadWeights = async () => {
    if (!user) return;

    const data = await getAllWeights(user.uid);
    setHistory(data);

    const current = data.find((w) => w.date === weekDate);
    setWeight(current ? String(current.weight) : "");
  };

  useEffect(() => {
    loadWeights();
  }, [selectedWeek, user]);

  /* ---------------- SAVE ---------------- */
  const saveWeight = async () => {
    if (!weight || !user) {
      setMessage("Please enter weight");
      return;
    }

    const record: BodyWeight = {
      id: weekDate,
      userId: user.uid,
      date: weekDate,
      weight: Number(weight),
      createdAt: Date.now(),
    };

    // SQLite first
    await insertWeight(record);

    // Firebase background sync
    await syncWeightAdd(user.uid, record);

    setMessage("Weight saved ✓");
    loadWeights();
  };

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
        <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
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
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          Save / Update
        </Text>
      </Pressable>

      <Text style={{ fontSize: 18, color: colors.textPrimary }}>
        History
      </Text>

      {history.map((item, index) => {
        const prev = history[index + 1];
        const diff = prev ? item.weight - prev.weight : 0;

        return (
          <Card key={item.id}>
            <Text style={{ color: colors.textPrimary }}>
              {item.date}: {item.weight} kg{" "}
              {prev && (
                <Text>
                  {diff > 0 ? "↑" : diff < 0 ? "↓" : "→"}{" "}
                  {Math.abs(diff).toFixed(1)} kg
                </Text>
              )}
            </Text>
          </Card>
        );
      })}
    </ScrollView>
  );
}
