import { MaterialIcons } from "@expo/vector-icons";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../providers/AuthContext";
import { ExerciseStrip } from "../../components/workout/ExerciseStrip";
import { PRBanner, type NewRecord } from "../../components/workout/PRBanner";
import { DateChip } from "../../components/workout/DateChip";
import { ExerciseMenu } from "../../components/workout/ExerciseMenu";
import { ExerciseView } from "../../components/workout/ExerciseView";
import { RestBar, RestPill } from "../../components/workout/RestBar";
import { SlideIn } from "../../components/workout/SlideIn";
import { SummarySheet } from "../../components/workout/SummarySheet";
import { MuscleIcon } from "../../components/muscle/MuscleIcon";
import { Button } from "../../components/ui/Button";
import { Reveal } from "../../components/ui/Reveal";
import { Sheet } from "../../components/ui/Sheet";
import { useConnection } from "../../providers/ConnectionContext";
import { useToast } from "../../providers/ToastContext";
import { clearDraft, completeSet, deleteSet, displayCategory, doneSets, draftName, getDraft, hasDoneSets, insertSet, loadDraft, removeExercise, setActiveExercise, setDate, startRest, updateDraft, useWorkoutDraft, type DraftExercise, type LastTimeLookup } from "../../hooks/workoutDraft";
import { saveWorkout } from "../../hooks/workoutSave";
import { useAchievementUnlockHandler } from "../../hooks/useAchievements";
import { useLeaveGuard } from "../../hooks/useLeaveGuard";
import { useRestTimer } from "../../hooks/useRestTimer";
import { historyPrefill, useExerciseIndex } from "../../hooks/useWorkoutData";
import { cancelRestEndNotification, scheduleRestEndNotification } from "../../notifications/notificationService";
import { useTheme } from "../../theme/theme";
import { size, spacing, tracking, typography } from "../../theme/tokens";
import { allSets, checkPR, indexAsOf, prDetail, exerciseKey, formatSet, type LoggedSet } from "../../utils/exerciseHistory";
import { perfEndAfterFrame, perfStart } from "../../utils/perf";
import { toKg } from "../../utils/unitConversion";
import { formatDate, parseLocalDate, FIRST_DAY_OF_WEEK } from "../../utils/dates";
import { ThemedDateTimePicker } from "../../components/ui/ThemedDateTimePicker";

/** Horizontal swipe on the exercise view: start tracking / switch exercise. */
const SWIPE_ACTIVATE = 24;
const SWIPE_FAIL_Y = 14;
const SWIPE_SWITCH = 64;

/** The active session: one exercise in focus, the others in a strip. */
export default function WorkoutSession() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();
  const connection = useConnection();
  const draft = useWorkoutDraft();

  const [record, setRecord] = useState<NewRecord | null>(null);
  const [menuFor, setMenuFor] = useState<DraftExercise | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // The Android date dialog reopens whenever its value or onChange changes, so both stay
  // the same while it is open; otherwise a re-render snaps it back to the day it opened on.
  const [datePickerValue, setDatePickerValue] = useState<Date | null>(null);
  const onDatePicked = useCallback((event: DateTimePickerEvent, d?: Date) => {
    setDatePickerValue(null);
    if (event.type === "set" && d) {
      const key = formatDate(d);
      updateDraft((s) => setDate(s, key === formatDate(new Date()) ? null : key));
    }
  }, []);
  const { pendingLeave, leave, stay, allowLeave } = useLeaveGuard(user?.uid);

  // Opened directly (e.g. after a restart): load the saved session, else go to the picker.
  useEffect(() => {
    if (getDraft() || !user) return;
    void loadDraft(user.uid).then((d) => {
      if (!d) router.replace("/workout/pick");
    });
  }, [user]);

  // History: shared index, built once per workouts change
  // Backdated session: "Last time", prefill and records use history up to that date only.
  const full = useExerciseIndex();
  const { index, summaries } = useMemo(() => indexAsOf(full.index, full.summaries, draft?.date ?? null), [full.index, full.summaries, draft?.date]);
  const unit = draft?.unit ?? "kg";
  const lastTime: LastTimeLookup = useMemo(() => historyPrefill(index, unit), [index, unit]);
  const kgOf = useCallback((weight: number | null, reps: number | null): LoggedSet => ({ weight: toKg(weight ?? 0, unit), reps: reps ?? 0 }), [unit]);

  /** Sets that were PRs when logged. No PRs on an exercise's first-ever session. */
  const prSets = useMemo(() => {
    const out = new Set<string>();
    for (const ex of draft?.exercises ?? []) {
      const h = index.get(exerciseKey(ex.name));
      if (!h?.sessions.length) continue;
      const prior = allSets(h).slice();
      for (const s of ex.sets) {
        if (!s.done) continue;
        const set = kgOf(s.weight, s.reps);
        if (checkPR(prior, set).isPR) out.add(s.id);
        prior.push(set);
      }
    }
    return out;
  }, [draft?.exercises, index, kgOf]);

  const rest = draft?.rest ?? null;
  const restTimer = useRestTimer(rest?.endsAt ?? null);

  // Switching exercises
  const go = useCallback((delta: number) => {
    const d = getDraft();
    if (!d) return;
    const i = d.exercises.findIndex((e) => e.key === d.activeKey);
    const next = d.exercises[i + delta];
    if (next) {
      Haptics.selectionAsync().catch(() => {});
      updateDraft((s) => setActiveExercise(s, next.key));
    }
  }, []);
  const select = useCallback((key: string) => updateDraft((s) => setActiveExercise(s, key)), []);
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-SWIPE_ACTIVATE, SWIPE_ACTIVATE])
        .failOffsetY([-SWIPE_FAIL_Y, SWIPE_FAIL_Y])
        .runOnJS(true)
        .onEnd((e) => {
          if (e.translationX <= -SWIPE_SWITCH) go(1);
          else if (e.translationX >= SWIPE_SWITCH) go(-1);
        }),
    [go],
  );

  // Slide direction follows the order of the exercises.
  const activeIndex = draft ? draft.exercises.findIndex((e) => e.key === draft.activeKey) : -1;
  const lastIndex = useRef(activeIndex);
  const direction = activeIndex >= lastIndex.current ? 1 : -1;
  useEffect(() => {
    lastIndex.current = activeIndex;
  }, [activeIndex]);

  const openPicker = () => {
    perfStart("open picker");
    router.push({ pathname: "/workout/pick", params: { mode: "add" } });
  };

  // Set actions
  const complete = (ex: DraftExercise, setId: string) => {
    const d = getDraft();
    if (!d) return;
    const editing = d.editingSetId === setId;
    const idx = ex.sets.findIndex((s) => s.id === setId);
    const set = ex.sets[idx];
    const h = index.get(exerciseKey(ex.name));

    if (!editing && h?.sessions.length) {
      const prior = [...allSets(h), ...ex.sets.slice(0, idx).filter((s) => s.done).map((s) => kgOf(s.weight, s.reps))];
      const logged = kgOf(set.weight, set.reps);
      const { isPR, previous, kind } = checkPR(prior, logged);
      if (isPR && previous && kind) {
        setRecord({
          id: set.id,
          title: `New record! ${ex.name} ${formatSet(logged, unit)}`,
          detail: prDetail(logged, previous, kind, unit),
        });
      }
    }

    updateDraft((s) => completeSet(s, ex.key, setId, lastTime));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!editing) {
      const seconds = ex.restSeconds ?? restTimer.defaultSeconds();
      updateDraft((s) => startRest(s, seconds));
      void scheduleRestEndNotification(Date.now() + seconds * 1000, `Next: ${ex.name}, set ${idx + 2}`);
    }
  };

  const deleteWithUndo = (ex: DraftExercise, setId: string) => {
    const idx = ex.sets.findIndex((s) => s.id === setId);
    const set = ex.sets[idx];
    if (!set) return;
    updateDraft((d) => deleteSet(d, ex.key, setId));
    showToast({
      type: "undo",
      message: `Set ${idx + 1} deleted`,
      subtitle: ex.name,
      actionLabel: "Undo",
      onAction: () => updateDraft((d) => insertSet(d, ex.key, set, idx)),
    });
  };

  const remove = (ex: DraftExercise) => {
    updateDraft((s) => removeExercise(s, ex.key));
    showToast({ type: "info", message: "Exercise removed", subtitle: ex.name });
  };

  // Finish
  const openSummary = () => {
    perfStart("finish sheet");
    setSummaryOpen(true);
  };
  useEffect(() => {
    if (summaryOpen) perfEndAfterFrame("finish sheet");
  }, [summaryOpen]);

  const save = async () => {
    if (!user || savingRef.current) return;
    savingRef.current = true;
    setSaving(true); // spinner on the very next frame
    perfStart("save (batch request)");
    try {
      if (connection.state === "offline" || connection.state === "unreachable") {
        setSummaryOpen(false);
        showToast({ type: "warning", message: "Can't save while offline", subtitle: "Your workout is kept on this phone. Finish when you're back online." });
        return;
      }
      const result = await saveWorkout(queryClient);
      perfEndAfterFrame("save (batch request)");
      if (!result.saved) {
        setSummaryOpen(false);
        const status = (result.error as { status?: number } | undefined)?.status;
        showToast({
          type: "error",
          message: "Couldn't save workout",
          subtitle:
            status === 404
              ? "The server doesn't support saving sessions yet. Nothing was saved; your workout is kept here."
              : "Nothing was saved. Your workout is kept here; tap Finish to try again.",
        });
        return;
      }
      const d = getDraft();
      const sets = d ? d.exercises.reduce((n, e) => n + doneSets(e).length, 0) : 0;
      const name = d ? draftName(d) : "Workout";
      void handleUnlocks(result.newlyUnlocked);
      allowLeave.current = true;
      void cancelRestEndNotification();
      await clearDraft(user.uid);
      setSummaryOpen(false);
      // Back to the tabs already underneath, then Home. (replace("/(tabs)") stacked a new
      // copy of every tab on each save; they all kept re-rendering and each save got slower.)
      if (router.canDismiss()) router.dismissAll();
      else router.replace("/(tabs)");
      router.navigate("/(tabs)");
      showToast({ type: "success", message: "Workout saved", subtitle: `${name} · ${sets} ${sets === 1 ? "set" : "sets"}` });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!draft) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const active = draft.exercises.find((e) => e.key === draft.activeKey) ?? null;
  const anyDone = hasDoneSets(draft);
  // Target shows arm sub-groups ("Biceps & Triceps"); workouts still save the category.
  const categories = [...new Set(draft.exercises.map((e) => e.subgroup ?? e.category))];
  const target = categories.length ? categories.map(displayCategory).join(" & ") : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs, gap: spacing.xs }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: size.control, height: size.control, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialIcons name="arrow-back" size={size.iconLg} color={colors.textSecondary} />
        </Pressable>
        <Text style={[typography.headlineSm, { flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
          Log workout
        </Text>
        <DateChip date={draft.date} onPress={() => setDatePickerValue(draft.date ? parseLocalDate(draft.date) : new Date())} />
      </View>

      {/* Name, target, rest */}
      <Reveal index={0} style={{ paddingHorizontal: spacing.screen, gap: spacing.xxs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <Text style={[typography.headlineMd, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
            {draftName(draft)}
          </Text>
          {rest && <RestPill endsAt={rest.endsAt} />}
        </View>
        {target && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {categories.slice(0, 3).map((c) => (
              <MuscleIcon key={c} category={c} size={size.iconSm} active />
            ))}
            <Text style={[typography.labelMd, { color: colors.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
              Target: {target}
            </Text>
          </View>
        )}
      </Reveal>

      {/* Sticky exercise strip */}
      <Reveal index={1} style={{ paddingVertical: spacing.sm }}>
        <ExerciseStrip exercises={draft.exercises} activeKey={draft.activeKey} onSelect={select} onAdd={openPicker} />
      </Reveal>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={spacing.xl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.lg, flexGrow: 1 }}
      >
        {record && <PRBanner record={record} onDone={() => setRecord(null)} />}

        <GestureDetector gesture={swipe}>
          <View style={{ flexGrow: 1 }} collapsable={false}>
            {active ? (
              <SlideIn key={active.key} direction={direction}>
                <ExerciseView
                  draft={draft}
                  exercise={active}
                  history={index.get(exerciseKey(active.name))}
                  summary={summaries.get(exerciseKey(active.name))}
                  prSets={prSets}
                  lastTime={lastTime}
                  onMenu={() => setMenuFor(active)}
                  onComplete={(setId) => complete(active, setId)}
                  onDelete={(setId) => deleteWithUndo(active, setId)}
                />
              </SlideIn>
            ) : (
              <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl }}>
                <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>No exercises yet. Add one to start logging.</Text>
                <Button title="Add exercise" icon="add" variant="tonal" onPress={openPicker} />
              </View>
            )}
          </View>
        </GestureDetector>
      </KeyboardAwareScrollView>

      {/* Footer */}
      <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm, backgroundColor: colors.bg }}>
        {rest && <RestBar endsAt={rest.endsAt} onExtend={restTimer.extend} onSkip={restTimer.skip} />}
        <Button
          title="Finish workout"
          icon="flag-outline"
          onPress={openSummary}
          disabled={!anyDone}
          fullWidth
          style={{ minHeight: size.ctaTall }}
          accessibilityHint={anyDone ? "Shows a summary before saving" : "Complete at least one set first"}
        />
      </View>

      {datePickerValue && (
        <ThemedDateTimePicker
          value={datePickerValue}
          mode="date"
          firstDayOfWeek={FIRST_DAY_OF_WEEK}
          maximumDate={new Date()}
          onChange={onDatePicked}
        />
      )}

      <ExerciseMenu draft={draft} exercise={menuFor} onClose={() => setMenuFor(null)} onRemove={remove} />

      {/* Leave */}
      <Sheet visible={!!pendingLeave} onClose={stay} title="Leave workout?" subtitle="Your completed sets aren't saved to your history yet.">
        <View style={{ gap: spacing.sm }}>
          <Button title="Keep for later" onPress={() => void leave(true)} fullWidth />
          <Button title="Discard workout" variant="destructive" onPress={() => void leave(false)} fullWidth />
          <Button title="Cancel" variant="ghost" onPress={stay} fullWidth />
        </View>
      </Sheet>

      {/* Summary */}
      <SummarySheet
        visible={summaryOpen}
        draft={draft}
        prCount={prSets.size}
        saving={saving}
        onSave={() => void save()}
        onClose={() => !saving && setSummaryOpen(false)}
      />
    </View>
  );
}
