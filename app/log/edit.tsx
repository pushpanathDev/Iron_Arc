import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NavigationAction } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Reveal } from "../../components/ui/Reveal";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { Stepper } from "../../components/ui/Stepper";
import { TextField } from "../../components/ui/TextField";
import { useToast } from "../../context/ToastContext";
import { displayCategory } from "../../hooks/logSession";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useAllWorkouts, useUpdateWorkout, useWorkout, workoutKeys } from "../../hooks/useWorkouts";
import { scheduleWorkoutDelete, UNDO_WINDOW_MS, undoWorkoutDelete } from "../../hooks/workoutDeleteQueue";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { displayWeight, toKg, weightLabel, weightStep } from "../../utils/unitConversion";
import { formatDate, parseLocalDate } from "../../utils/weekUtils";

const MAX_WEIGHT = 9999;
const MAX_REPS = 999;
const MAX_SETS = 50;
const NOTES_MAX = 500;
const DAY_MS = 86_400_000;

type EditSet = { key: string; weight: number | null; reps: number | null };
let seq = 0;
const newKey = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

/* ==============================
   EDIT WORKOUT (one logged exercise)
   ============================== */

export default function EditWorkout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { unit, loaded: unitLoaded } = useUnitPreference();

  // From the shared list for an instant open; the detail query refreshes it.
  const listItem = useAllWorkouts().data?.find((w) => w.id === id);
  const detail = useWorkout(id ?? "").data;
  const workout = detail ?? listItem;
  const update = useUpdateWorkout();

  const [date, setDate] = useState<string | null>(null);
  const [sets, setSets] = useState<EditSet[]>([]);
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [leaveAction, setLeaveAction] = useState<NavigationAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const allowLeave = useRef(false);

  // Fill the form once, after the unit preference is known (so values don't flip units).
  useEffect(() => {
    if (loaded || !workout || !unitLoaded) return;
    setDate(workout.date.slice(0, 10));
    setSets(
      [...workout.sets]
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((s) => ({ key: newKey(), weight: Math.round(displayWeight(s.weight, unit) * 10) / 10, reps: s.reps })),
    );
    setNotes(workout.notes ?? "");
    setLoaded(true);
  }, [loaded, workout, unitLoaded, unit]);

  const original = useMemo(() => {
    if (!workout) return "";
    const s = [...workout.sets].sort((a, b) => a.setNumber - b.setNumber).map((x) => [Math.round(displayWeight(x.weight, unit) * 10) / 10, x.reps]);
    return JSON.stringify([workout.date.slice(0, 10), s, workout.notes ?? ""]);
  }, [workout, unit]);
  const current = JSON.stringify([date, sets.map((s) => [s.weight, s.reps]), notes]);
  const dirty = loaded && current !== original;
  const valid = sets.length > 0 && sets.every((s) => s.weight != null && s.reps != null && s.reps >= 1);

  /* ---------- leaving with unsaved changes ---------- */
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (allowLeave.current || !dirty) return;
        e.preventDefault();
        setLeaveAction(e.data.action);
      }),
    [navigation, dirty],
  );

  const leave = (action?: NavigationAction | null) => {
    allowLeave.current = true;
    if (action) navigation.dispatch(action);
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/history");
  };

  /* ---------- sets ---------- */
  const updateSet = (key: string, patch: Partial<EditSet>) => setSets((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const removeSet = (key: string) => setSets((list) => list.filter((s) => s.key !== key));
  const addSet = () =>
    setSets((list) => {
      if (list.length >= MAX_SETS) return list;
      const last = list[list.length - 1];
      return [...list, { key: newKey(), weight: last?.weight ?? null, reps: last?.reps ?? null }];
    });

  /* ---------- save / delete ---------- */
  const save = async () => {
    if (!workout || !date || !valid || update.isPending) return;
    try {
      await update.mutateAsync({
        id: workout.id,
        data: {
          date,
          exercise: workout.exercise,
          category: workout.category,
          notes: notes.trim() ? notes.trim() : null,
          sets: sets.map((s) => ({ reps: s.reps!, weight: toKg(s.weight!, unit) })),
        },
      });
      showToast({ type: "success", message: "Workout updated", subtitle: workout.exercise });
      leave();
    } catch {
      // useUpdateWorkout shows the error toast and rolls back.
    }
  };

  const remove = () => {
    if (!workout) return;
    setConfirmDelete(false);
    void queryClient.cancelQueries({ queryKey: workoutKeys.all });
    scheduleWorkoutDelete(queryClient, workout.id);
    showToast({
      type: "undo",
      message: "Workout deleted",
      subtitle: workout.exercise,
      actionLabel: "Undo",
      duration: UNDO_WINDOW_MS,
      onAction: () => void undoWorkoutDelete(queryClient, workout.id),
    });
    leave();
  };

  const todayKey = formatDate(new Date());

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs, gap: spacing.xs }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/history"))}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: size.control, height: size.control, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialIcons name="arrow-back" size={size.iconLg} color={colors.textSecondary} />
        </Pressable>
        <Text style={[typography.headlineSm, { flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
          Edit workout
        </Text>
        {date && (
          <Pressable
            onPress={() => setDateOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Workout date: ${dayLabel(date, todayKey)}`}
            accessibilityHint="Change the date (past dates allowed)"
            style={({ pressed }) => ({
              minHeight: size.control,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xxs,
              paddingLeft: spacing.md,
              paddingRight: spacing.sm,
              marginRight: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: pressed ? colors.surfaceContainerHighest : colors.surfaceContainerHigh,
            })}
          >
            <Text style={[typography.labelLg, { color: colors.text }]}>{dayLabel(date, todayKey)}</Text>
            <MaterialIcons name="arrow-drop-down" size={size.iconLg} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {!workout || !loaded ? (
        <View style={{ padding: spacing.screen, gap: spacing.md }} accessibilityLabel="Loading workout">
          <SkeletonBlock height={size.control} radius="lg" />
          <SkeletonBlock height={size.goalCard} radius="xl" />
          <SkeletonBlock height={size.goalCard} radius="xl" />
        </View>
      ) : (
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          bottomOffset={spacing.xl}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.md }}
        >
          <Reveal index={0} style={{ gap: spacing.xxs }}>
            <Text style={[typography.headlineMd, { color: colors.text }]}>{workout.exercise}</Text>
            <Text style={[typography.labelMd, { color: colors.textSecondary }]}>
              {displayCategory(workout.category)} · {sets.length} {sets.length === 1 ? "set" : "sets"}
            </Text>
          </Reveal>

          {sets.map((s, i) => (
            <Reveal key={s.key} index={Math.min(i + 1, 4)} style={{ padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.raised, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Set {i + 1}</Text>
                {sets.length > 1 && (
                  <Pressable
                    onPress={() => removeSet(s.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove set ${i + 1}`}
                    style={({ pressed }) => ({
                      width: size.control,
                      height: size.control,
                      marginRight: -spacing.sm,
                      marginVertical: -spacing.sm,
                      borderRadius: radius.full,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
                    })}
                  >
                    <MaterialIcons name="close" size={size.icon} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <Stepper
                  label={`Weight (${weightLabel(unit)})`}
                  value={s.weight}
                  onChange={(weight) => updateSet(s.key, { weight })}
                  step={weightStep(unit)}
                  max={MAX_WEIGHT}
                  decimal
                  accessibilityUnit={weightLabel(unit)}
                />
                <Stepper label="Reps" value={s.reps} onChange={(reps) => updateSet(s.key, { reps })} step={1} min={1} max={MAX_REPS} />
              </View>
            </Reveal>
          ))}

          <Button title="Add set" icon="add" variant="ghost" onPress={addSet} fullWidth disabled={sets.length >= MAX_SETS} />

          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={NOTES_MAX} placeholder="How did it feel?" />

          <Button title="Delete workout" icon="trash-outline" variant="ghostDanger" onPress={() => setConfirmDelete(true)} fullWidth />
        </KeyboardAwareScrollView>
      )}

      {/* Footer */}
      {workout && loaded && (
        <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.bg }}>
          <Button
            title={dirty ? "Save changes" : "No changes"}
            icon="checkmark"
            onPress={() => void save()}
            disabled={!dirty || !valid || update.isPending}
            loading={update.isPending}
            fullWidth
            haptic
            style={{ minHeight: size.ctaTall }}
            accessibilityHint={!valid ? "Every set needs a weight and at least 1 rep" : undefined}
          />
        </View>
      )}

      {dateOpen && date && (
        <DateTimePicker
          value={parseLocalDate(date)}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setDateOpen(false);
            if (d) setDate(formatDate(d));
          }}
        />
      )}

      <Sheet visible={!!leaveAction} onClose={() => setLeaveAction(null)} title="Discard changes?" subtitle="Your edits to this workout haven't been saved.">
        <View style={{ gap: spacing.sm }}>
          <Button title="Keep editing" onPress={() => setLeaveAction(null)} fullWidth />
          <Button
            title="Discard changes"
            variant="destructive"
            onPress={() => {
              const action = leaveAction;
              setLeaveAction(null);
              leave(action);
            }}
            fullWidth
          />
        </View>
      </Sheet>

      <ConfirmDialog
        visible={confirmDelete}
        destructive
        title="Delete this workout?"
        message={workout ? `This removes ${workout.exercise} and its ${workout.sets.length} logged ${workout.sets.length === 1 ? "set" : "sets"} from your training history. You'll have a few seconds to undo.` : ""}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}

/** "Today", "Yesterday", "Mon 5 Oct". */
function dayLabel(key: string, todayKey: string) {
  const diff = Math.round((parseLocalDate(todayKey).getTime() - parseLocalDate(key).getTime()) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return parseLocalDate(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
