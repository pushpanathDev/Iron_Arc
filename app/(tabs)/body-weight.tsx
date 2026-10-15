import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useAuth } from "../../providers/AuthContext";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Reveal } from "../../components/ui/Reveal";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { RepeatButton } from "../../components/ui/Stepper";
import { BathroomScale } from "../../components/weight/BathroomScale";
import { GoalSheet } from "../../components/weight/GoalSheet";
import { deltaColor, signed } from "../../components/weight/weightChange";
import { entriesInRange, shortDate as chartShortDate, TREND_RANGES, WeightTrendChart, type TrendRange } from "../../components/weight/WeightTrendChart";
import { useToast } from "../../providers/ToastContext";
import { ACHIEVEMENTS_KEY, useAchievementUnlockHandler } from "../../hooks/useAchievements";
import { useProfile } from "../../hooks/useProfile";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useAllWeights, useLogWeight } from "../../hooks/useWeights";
import { ApiError, isNetworkApiError, weightApi, type BodyWeight } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { alpha, motion, radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { getInitials } from "../../utils/avatar";
import {
  changeOver,
  formatValue,
  fromDisplay,
  goalProgress,
  maxFor,
  minFor,
  parseWeight,
  stepWeight,
  toDisplay,
  towardGoal,
  weightError,
  WEIGHT_STEP,
} from "../../utils/bodyWeightRules";
import { createPageLogger } from "../../utils/logger";
import { weightLabel, type WeightUnit } from "../../utils/unitConversion";
import { formatDate, getWeekStart, parseLocalDate, FIRST_DAY_OF_WEEK } from "../../utils/weekUtils";

const log = createPageLogger("BodyWeight");

const UNDO_WINDOW_MS = 5000;
const EMPTY: BodyWeight[] = [];
const HISTORY_PREVIEW = 10;
const DAY_MS = 86_400_000;
/** Fallback start for the stepper when there's no entry, no earlier entry and no profile weight. */
const FALLBACK_KG = 70;

export default function BodyWeightScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: raw = EMPTY, refetch, isLoading } = useAllWeights();
  const logWeight = useLogWeight();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const handleUnlocks = useAchievementUnlockHandler();
  const { unit, setUnit } = useUnitPreference();
  const scrollRef = useRef<ScrollView>(null);

  // Deferred delete with undo
  // Hidden from the list (not removed from the cache) during the undo window,
  // so a refetch can't bring them back. Sent when the window closes, or at once
  // if the app goes to the background.
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(() => new Set());
  const deleteTimers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; item: BodyWeight }>());

  const history = useMemo(
    () => raw.filter((w) => !pendingDeleteIds.has(w.id)).sort((a, b) => b.date.localeCompare(a.date)),
    [raw, pendingDeleteIds],
  );

  const todayKey = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // Stable: the Android dialog reopens (and loses the tapped day) when onChange changes.
  const onDatePicked = useCallback((event: DateTimePickerEvent, d?: Date) => {
    setDatePickerOpen(false);
    if (event.type === "set" && d) setSelectedDate(d);
  }, []);
  const [range, setRange] = useState<TrendRange>("30D");
  const [goalOpen, setGoalOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const logDate = formatDate(selectedDate);
  const existing = history.find((w) => w.date.slice(0, 10) === logDate);
  // Start the stepper from this day's entry, else the latest earlier one, else the profile weight.
  const earlier = history.find((w) => w.date.slice(0, 10) < logDate);
  const prefillKg = existing?.weight ?? earlier?.weight ?? profile?.weight ?? null;

  // The value being entered (display unit)
  const [value, setValue] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [dialValue, setDialValue] = useState<number | null>(null);

  useEffect(() => {
    const v = prefillKg == null ? null : toDisplay(prefillKg, unit);
    setValue(v);
    setTyping(false);
  }, [logDate, prefillKg, unit]);

  // Text mirrors the value except while the user is typing.
  useEffect(() => {
    if (!typing) setText(value == null ? "" : formatValue(value));
  }, [value, typing]);

  // The scale reading follows steppers at once, and typed values once typing pauses
  // (so "7" on the way to "75" doesn't roll it down and back).
  useEffect(() => {
    if (!typing) {
      setDialValue(value);
      return;
    }
    const t = setTimeout(() => setDialValue(value), motion.dialTypeDebounceMs);
    return () => clearTimeout(t);
  }, [value, typing]);

  const fallback = prefillKg != null ? toDisplay(prefillKg, unit) : toDisplay(FALLBACK_KG, unit);
  const step = useCallback(
    (dir: 1 | -1) => {
      setTyping(false);
      setValue((v) => stepWeight(v, dir, unit, fallback));
    },
    [unit, fallback],
  );

  const error = weightError(value, unit);
  // While typing, "7" on the way to "75" isn't an error yet; over the maximum is.
  const showError = !!error && value != null && (!typing || value > maxFor(unit));

  // Save
  const save = async () => {
    if (error || value == null || logWeight.isPending) return;
    try {
      await logWeight.mutateAsync({ date: logDate, weight: fromDisplay(value, unit), weekStart: formatDate(getWeekStart(selectedDate)) });
      setTyping(false);
      showToast({
        type: "success",
        message: existing ? "Entry updated" : "Weight saved",
        subtitle: `${formatValue(value)} ${weightLabel(unit)} · ${dayLabel(logDate, todayKey)}`,
      });
      log.success("Weight saved", `${value}${weightLabel(unit)} on ${logDate}`);
    } catch (e) {
      // useLogWeight shows the error toast and rolls back.
      log.error("Save failed", e instanceof Error ? e.message : String(e));
    }
  };

  // Delete
  const setPending = (id: string, pending: boolean) =>
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });

  const commitDelete = useCallback(
    async (item: BodyWeight) => {
      const entry = deleteTimers.current.get(item.id);
      if (entry) clearTimeout(entry.timer);
      deleteTimers.current.delete(item.id);
      let newlyUnlocked: string[] = [];
      try {
        ({ newlyUnlocked } = await weightApi.delete(item.id));
      } catch (e) {
        // 404: already gone on the server — treat as deleted.
        if (!(e instanceof ApiError && e.status === 404)) {
          setPending(item.id, false);
          showToast({
            type: "error",
            message: "Couldn't delete weight entry",
            subtitle: isNetworkApiError(e) ? "Can't reach the server. It's back in your list." : "It's back in your list.",
          });
          return;
        }
      }
      queryClient.setQueryData<BodyWeight[]>(["weights", "all"], (old) => (old ? old.filter((w) => w.id !== item.id) : old));
      setPending(item.id, false);
      void queryClient.invalidateQueries({ queryKey: ["weights"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void handleUnlocks(newlyUnlocked);
    },
    [queryClient, showToast, handleUnlocks],
  );

  const deleteEntry = useCallback(
    async (item: BodyWeight) => {
      if (deleteTimers.current.has(item.id)) return;
      await queryClient.cancelQueries({ queryKey: ["weights"] });
      setPending(item.id, true);
      deleteTimers.current.set(item.id, { item, timer: setTimeout(() => void commitDelete(item), UNDO_WINDOW_MS) });
      showToast({
        type: "undo",
        message: `${dayLabel(item.date.slice(0, 10), todayKey)} entry deleted`,
        subtitle: `${formatValue(toDisplay(item.weight, unit))} ${weightLabel(unit)}`,
        actionLabel: "Undo",
        duration: UNDO_WINDOW_MS,
        onAction: () => {
          const entry = deleteTimers.current.get(item.id);
          if (!entry) return;
          clearTimeout(entry.timer);
          deleteTimers.current.delete(item.id);
          setPending(item.id, false);
        },
      });
    },
    [queryClient, commitDelete, showToast, todayKey, unit],
  );

  // Backgrounded or leaving: send pending deletes now rather than dropping them.
  // (Through a ref, so this runs on unmount only, not whenever callbacks change.)
  const commitRef = useRef(commitDelete);
  commitRef.current = commitDelete;
  useEffect(() => {
    const flush = () => deleteTimers.current.forEach(({ item }) => void commitRef.current(item));
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") flush();
    });
    const timers = deleteTimers.current;
    return () => {
      sub.remove();
      timers.forEach(({ item }) => void commitRef.current(item));
      void queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
    };
  }, [queryClient]);

  const editDay = useCallback((item: BodyWeight) => {
    setSelectedDate(parseLocalDate(item.date.slice(0, 10)));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // Derived
  const latest = history[0] ?? null;
  const first = history[history.length - 1] ?? null;
  const goalKg = profile?.targetWeight ?? null;
  const fitnessGoal = profile?.fitnessGoal;
  const change = changeOver(history);
  const inRange = useMemo(() => entriesInRange(history, range, todayKey), [history, range, todayKey]);
  const shown = showAll ? history : history.slice(0, HISTORY_PREVIEW);
  const nameSource = profile?.displayName || user?.displayName || profile?.email || user?.email || "";
  const avatarPhoto = profile?.avatarUrl || user?.photoURL || null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: spacing.screen, paddingRight: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: size.tileSm, height: size.tileSm, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name="monitor-weight" size={size.icon} color={colors.accent} />
          </View>
          <Text style={[typography.headlineMd, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
            Weight
          </Text>
        </View>
        <Avatar key={avatarPhoto ?? "initials"} photoUri={avatarPhoto} initials={nameSource ? getInitials(nameSource) : ""} onPress={() => router.navigate("/(tabs)/profile")} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.card} />}
      >
        {isLoading && raw.length === 0 ? (
          <WeightSkeleton />
        ) : (
          <>
            {/* Current weight + unit */}
            <Reveal index={0}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>Current body weight</Text>
                {latest ? (
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }} accessible accessibilityLabel={`Current body weight ${formatValue(toDisplay(latest.weight, unit))} ${weightLabel(unit)}`}>
                    <Text style={[typography.displayMd, { color: colors.text }]}>{formatValue(toDisplay(latest.weight, unit))}</Text>
                    <Text style={[typography.headlineSm, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
                  </View>
                ) : (
                  <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>No weigh-ins yet. Log your first one below.</Text>
                )}
                {change && latest && (
                  <ChangePill
                    deltaKg={change.deltaKg}
                    days={change.days}
                    sinceDate={change.sinceDate}
                    unit={unit}
                    color={deltaColor(latest.weight - change.deltaKg, latest.weight, goalKg, fitnessGoal, colors)}
                  />
                )}
              </View>
              <UnitToggle unit={unit} onChange={setUnit} />
            </View>
            </Reveal>

            {/* Log card */}
            <Reveal index={1}>
            <View style={{ padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised, gap: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }}>
                <Pressable
                  onPress={() => setDatePickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Logging for ${fullDate(logDate)}`}
                  accessibilityHint="Change the date (past dates allowed)"
                  style={({ pressed }) => ({ minHeight: size.control, justifyContent: "center", flexShrink: 1, opacity: pressed ? alpha.divider : 1 })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <Text style={[typography.headlineSm, { color: colors.text }]}>{dayLabel(logDate, todayKey)}</Text>
                    <MaterialIcons name="expand-more" size={size.icon} color={colors.textSecondary} />
                  </View>
                  <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{fullDate(logDate)}</Text>
                </Pressable>
                {existing && (
                  <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh }}>
                    <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Logged {timeOf(existing.updatedAt)}</Text>
                  </View>
                )}
              </View>

              <BathroomScale value={dialValue} unit={unit} />

              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <RepeatButton icon="remove" onStep={() => step(-1)} label={`Decrease by ${WEIGHT_STEP} ${weightLabel(unit)}`} filled />
                <View style={{ flex: 1, alignItems: "center", gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
                    <TextInput
                      value={text}
                      onChangeText={(t) => {
                        setTyping(true);
                        setText(t);
                        setValue(parseWeight(t));
                      }}
                      onBlur={() => setTyping(false)}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      selectTextOnFocus
                      maxLength={6}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      accessibilityLabel={`Weight in ${weightLabel(unit)}`}
                      accessibilityHint={`Type an exact weight, ${minFor(unit)} to ${maxFor(unit)}`}
                      style={[typography.headlineLg, { color: colors.text, textAlign: "center", minWidth: size.control, paddingVertical: 0 }]}
                    />
                    <Text style={[typography.headlineSm, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
                  </View>
                  <Text style={[typography.labelSm, { color: showError ? colors.danger : colors.textSecondary, textAlign: "center" }]} accessibilityLiveRegion="polite">
                    {showError ? error : `Tap the number to type · ± ${WEIGHT_STEP} ${weightLabel(unit)}`}
                  </Text>
                </View>
                <RepeatButton icon="add" onStep={() => step(1)} label={`Increase by ${WEIGHT_STEP} ${weightLabel(unit)}`} filled />
              </View>

              <Button
                title={saveTitle(!!existing, logDate, todayKey)}
                icon="checkmark"
                onPress={() => void save()}
                loading={logWeight.isPending}
                disabled={!!error || logWeight.isPending}
                fullWidth
                haptic
                style={{ minHeight: size.ctaTall }}
              />
            </View>
            </Reveal>

            {/* Trend */}
            <Reveal index={2}>
            <View style={{ padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised, gap: spacing.md }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
                    Trend
                  </Text>
                  {inRange.length >= 2 && (
                    <RangeChangePill
                      deltaKg={inRange[inRange.length - 1].weight - inRange[0].weight}
                      toward={towardGoal(inRange[0].weight, inRange[inRange.length - 1].weight, goalKg)}
                      range={range}
                      unit={unit}
                      color={deltaColor(inRange[0].weight, inRange[inRange.length - 1].weight, goalKg, fitnessGoal, colors)}
                    />
                  )}
                </View>
                <RangeToggle value={range} onChange={setRange} />
              </View>
              <WeightTrendChart entries={inRange} unit={unit} todayKey={todayKey} goalKg={goalKg} />
            </View>
            </Reveal>

            {/* Start / Change / Goal */}
            <Reveal index={3}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <StatCard
                label="Start"
                value={first ? formatValue(toDisplay(first.weight, unit)) : "–"}
                unit={first ? weightLabel(unit) : undefined}
                caption={first ? chartShortDate(first.date) : "No entries yet"}
              />
              <StatCard
                label="Change"
                value={first && latest && first !== latest ? signed(toDisplay(latest.weight - first.weight, unit)) : "–"}
                unit={first && latest && first !== latest ? weightLabel(unit) : undefined}
                valueColor={first && latest ? deltaColor(first.weight, latest.weight, goalKg, fitnessGoal, colors) : undefined}
                caption={changeCaption(first, latest, goalKg)}
              />
              <GoalCard goalKg={goalKg} latestKg={latest?.weight ?? null} unit={unit} onPress={() => setGoalOpen(true)} />
            </View>
            </Reveal>

            {/* History */}
            <Reveal index={4}>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm }}>
                <Text style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]} accessibilityRole="header">
                  History
                </Text>
                <Text style={[typography.labelMd, { color: colors.textSecondary }]}>
                  {history.length} {history.length === 1 ? "entry" : "entries"}
                </Text>
              </View>
              {history.length === 0 ? (
                <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>No entries yet.</Text>
              ) : (
                shown.map((item) => {
                  const idx = history.indexOf(item);
                  const older = history[idx + 1];
                  return (
                    <HistoryRow
                      key={item.id}
                      item={item}
                      diffKg={older ? item.weight - older.weight : null}
                      diffColor={older ? deltaColor(older.weight, item.weight, goalKg, fitnessGoal, colors) : colors.textSecondary}
                      unit={unit}
                      todayKey={todayKey}
                      onDelete={deleteEntry}
                      onEdit={editDay}
                    />
                  );
                })
              )}
              {history.length > HISTORY_PREVIEW && (
                <Button
                  title={showAll ? "Show less" : `Show all ${history.length} entries`}
                  variant="ghost"
                  onPress={() => setShowAll((v) => !v)}
                  fullWidth
                />
              )}
            </View>
            </Reveal>
          </>
        )}
      </ScrollView>

      <GoalSheet visible={goalOpen} onClose={() => setGoalOpen(false)} unit={unit} goalKg={goalKg} latestKg={latest?.weight ?? null} />

      {datePickerOpen && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          firstDayOfWeek={FIRST_DAY_OF_WEEK}
          maximumDate={new Date()}
          onChange={onDatePicked}
        />
      )}
    </View>
  );
}

// Pieces

function UnitToggle({ unit, onChange }: { unit: WeightUnit; onChange: (u: WeightUnit) => void }) {
  const { colors } = useTheme();
  const options: { value: WeightUnit; label: string }[] = [
    { value: "kg", label: "kg" },
    { value: "lbs", label: "lb" },
  ];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Weight unit" style={{ flexDirection: "row", padding: spacing.xxs, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
      {options.map((o) => {
        const active = o.value === unit;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.value === "kg" ? "Kilograms" : "Pounds"}
            style={{ minWidth: size.control, height: size.control - spacing.xs, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: active ? colors.surfaceContainerHighest : "transparent" }}
          >
            <Text style={[typography.labelLg, { color: active ? colors.text : colors.textSecondary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RangeToggle({ value, onChange }: { value: TrendRange; onChange: (r: TrendRange) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Time period" style={{ flexDirection: "row", padding: spacing.xxs, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh }}>
      {TREND_RANGES.map((r) => {
        const active = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            hitSlop={spacing.xs}
            style={{ minWidth: size.tileSm + spacing.sm, height: size.tileSm + spacing.xs, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: active ? colors.surfaceContainerHighest : "transparent" }}
          >
            <Text style={[typography.labelMd, { color: active ? colors.text : colors.textSecondary }]}>{r}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function changeCaption(first: BodyWeight | null, latest: BodyWeight | null, goalKg: number | null) {
  if (!first || !latest || first === latest) return "Log more days";
  const toward = towardGoal(first.weight, latest.weight, goalKg);
  if (toward != null) return toward ? "Toward goal" : "Away from goal";
  return `since ${chartShortDate(first.date)}`;
}

function ChangePill({ deltaKg, days, sinceDate, unit, color }: { deltaKg: number; days: number; sinceDate: string; unit: WeightUnit; color: string }) {
  const { colors } = useTheme();
  const delta = toDisplay(deltaKg, unit);
  const when = days >= 30 ? "in 30 days" : `since ${shortDate(sinceDate)}`;
  return (
    <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHighest }}>
      <MaterialIcons name={delta < 0 ? "trending-down" : delta > 0 ? "trending-up" : "trending-flat"} size={size.iconSm} color={color} />
      <Text style={[typography.labelMd, { color }]}>
        {signed(delta)} {weightLabel(unit)} {when}
      </Text>
    </View>
  );
}

/** "+0.8 kg · 30D · toward goal": change across the range on the chart (goal wording only when one is set). */
function RangeChangePill({ deltaKg, toward, range, unit, color }: { deltaKg: number; toward: boolean | null; range: TrendRange; unit: WeightUnit; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHighest }}>
      <Text style={[typography.labelMd, { color }]}>{`${signed(toDisplay(deltaKg, unit))} ${weightLabel(unit)} · ${range}${toward == null ? "" : toward ? " · toward goal" : " · away from goal"}`}</Text>
    </View>
  );
}

function StatCard({ label, value, unit, caption, valueColor }: { label: string; value: string; unit?: string; caption: string; valueColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.raised, gap: spacing.xxs }} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}. ${caption}`}>
      <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xxs }}>
        <Text style={[typography.headlineMd, { color: valueColor ?? colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit && <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
      <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

/** Goal card: the target and how far is left, or a prompt to set one. */
function GoalCard({ goalKg, latestKg, unit, onPress }: { goalKg: number | null; latestKg: number | null; unit: WeightUnit; onPress: () => void }) {
  const { colors } = useTheme();
  const progress = goalKg != null && latestKg != null ? goalProgress(latestKg, goalKg) : null;
  const caption =
    goalKg == null
      ? "Tap to set"
      : !progress
        ? "Log a weigh-in"
        : progress.reached
          ? "At goal"
          : `${formatValue(toDisplay(progress.leftKg, unit))} ${weightLabel(unit)} to ${progress.direction}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={goalKg == null ? "Weight goal: not set" : `Weight goal: ${formatValue(toDisplay(goalKg, unit))} ${weightLabel(unit)}. ${caption}`}
      accessibilityHint={goalKg == null ? "Set a target weight" : "Change or remove your goal"}
      style={({ pressed }) => ({ flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised, gap: spacing.xxs })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.labelWide }]}>Goal</Text>
        <MaterialIcons name={goalKg == null ? "add" : "flag"} size={size.iconSm} color={colors.warning} />
      </View>
      {goalKg == null ? (
        <Text style={[typography.headlineSm, { color: colors.warning }]}>Set goal</Text>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xxs }}>
          <Text style={[typography.headlineMd, { color: colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatValue(toDisplay(goalKg, unit))}
          </Text>
          <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
        </View>
      )}
      <Text style={[typography.labelSm, { color: progress?.reached ? colors.accent : colors.textSecondary }]} numberOfLines={1}>
        {caption}
      </Text>
    </Pressable>
  );
}

const HistoryRow = memo(function HistoryRow({
  item,
  diffKg,
  diffColor,
  unit,
  todayKey,
  onDelete,
  onEdit,
}: {
  item: BodyWeight;
  diffKg: number | null;
  diffColor: string;
  unit: WeightUnit;
  todayKey: string;
  onDelete: (item: BodyWeight) => void;
  onEdit: (item: BodyWeight) => void;
}) {
  const { colors } = useTheme();
  const date = item.date.slice(0, 10);
  const diff = diffKg == null ? null : toDisplay(diffKg, unit);
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={size.control}
      overshootRight={false}
      onSwipeableOpen={() => onDelete(item)}
      renderRightActions={() => (
        <View style={{ width: size.iconBadge + spacing.xl, marginLeft: spacing.sm, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: spacing.xxs, backgroundColor: colors.dangerSubtle }}>
          <MaterialIcons name="delete-outline" size={size.iconLg} color={colors.danger} />
          <Text style={[typography.labelMd, { color: colors.danger }]}>Delete</Text>
        </View>
      )}
    >
      <Pressable
        onPress={() => onEdit(item)}
        accessibilityRole="button"
        accessibilityLabel={`${dayLabel(date, todayKey)}, ${formatValue(toDisplay(item.weight, unit))} ${weightLabel(unit)}${diff != null ? `, ${signed(diff)} from the entry before` : ""}`}
        accessibilityHint="Edit this day's weight. Swipe left to delete."
        style={({ pressed }) => ({
          minHeight: size.exerciseRow,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.lg,
          backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
        })}
      >
        <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
          <MaterialIcons name="monitor-weight" size={size.icon} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text numberOfLines={1}>
            <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{dayLabel(date, todayKey)}</Text>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{`  ·  ${timeOf(item.updatedAt)}`}</Text>
          </Text>
          {diff != null && diff !== 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
              <MaterialIcons name={diff < 0 ? "arrow-drop-down" : "arrow-drop-up"} size={size.iconSm} color={diffColor} />
              <Text style={[typography.labelMd, { color: diffColor }]}>{formatValue(Math.abs(diff))}</Text>
            </View>
          ) : (
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{diff === 0 ? "No change" : "First entry"}</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xxs }}>
          <Text style={[typography.headlineMd, { color: colors.text }]}>{formatValue(toDisplay(item.weight, unit))}</Text>
          <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});

function WeightSkeleton() {
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel="Loading weight">
      <SkeletonBlock height={size.goalCard} radius="xl" />
      <SkeletonBlock height={size.goalCard * 3} radius="xl" />
      <SkeletonBlock height={size.trendChart + size.goalCard / 2} radius="xl" />
    </View>
  );
}

// Helpers

const asDate = (key: string) => parseLocalDate(key);
const shortDate = (key: string) => asDate(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const fullDate = (key: string) => asDate(key).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

/** "Today", "Yesterday", "Mon, Oct 21" — with `withDate`, "Today, Oct 24". */
function dayLabel(key: string, todayKey: string, withDate = false) {
  const diff = Math.round((asDate(todayKey).getTime() - asDate(key).getTime()) / DAY_MS);
  const date = shortDate(key);
  if (diff === 0) return withDate ? `Today, ${date}` : "Today";
  if (diff === 1) return withDate ? `Yesterday, ${date}` : "Yesterday";
  return asDate(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** "08:15 AM" in local time (when the entry was last saved). */
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function saveTitle(hasEntry: boolean, logDate: string, todayKey: string) {
  if (logDate === todayKey) return hasEntry ? "Update today's entry" : "Save today's weight";
  const d = shortDate(logDate);
  return hasEntry ? `Update ${d} entry` : `Save weight for ${d}`;
}
