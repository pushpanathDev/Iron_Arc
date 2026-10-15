import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, type LayoutChangeEvent, type ListRenderItem, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../providers/AuthContext";
import { ExerciseRow } from "../../components/workout/ExerciseRow";
import { ResumeWorkoutSheet } from "../../components/workout/ResumeWorkoutSheet";
import { MuscleIcon } from "../../components/muscle/MuscleIcon";
import type { MuscleGroup } from "../../components/muscle/musclePaths";
import { Button } from "../../components/ui/Button";
import { Reveal } from "../../components/ui/Reveal";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { TextField } from "../../components/ui/TextField";
import { useToast } from "../../providers/ToastContext";
import { addExercises, beginDraft, createDraft, getDraft, updateDraft, useWorkoutDraft, type NewExercise } from "../../hooks/workoutDraft";
import { useCreateExercise, useDeleteExercise } from "../../hooks/useExercises";
import { historyPrefill, PICKER_TILES, tileForCategory, useExerciseCatalog, useExerciseIndex, type CatalogExercise, type TileKey } from "../../hooks/useWorkoutData";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { ApiError } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { exerciseKey, formatSet, indexAsOf, prWithin, recentExercises } from "../../utils/exerciseHistory";
import { perfEndAfterFrame, perfMark, perfStart } from "../../utils/perf";
import { formatDate } from "../../utils/weekUtils";

const RECENT_COUNT = 5;
const GRID_COLUMNS = 3;
/** Fixed item heights, so the list never measures rows (getItemLayout). */
const ROW_HEIGHT = size.exerciseRow + spacing.sm;
const HEADER_HEIGHT = size.control;
const SKELETON_ROWS = 5;
const NO_ITEMS: Item[] = [];

type Item =
  | { type: "header"; key: string; title: string; right?: string; sticky: boolean }
  | { type: "row"; key: string; ex: CatalogExercise };

const header = (key: string, title: string, right: string | undefined, sticky: boolean): Item => ({ type: "header", key, title, right, sticky });
const rows = (prefix: string, list: CatalogExercise[]): Item[] => list.map((ex) => ({ type: "row", key: `${prefix}:${ex.name}`, ex }));
const countLabel = (n: number) => `${n} ${n === 1 ? "exercise" : "exercises"}`;

export default function LogPicker() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string; category?: string }>();
  const addMode = params.mode === "add";
  const { user } = useAuth();
  const { showToast } = useToast();
  const { unit } = useUnitPreference();
  const draft = useWorkoutDraft();

  // Preselected only when opened from Home's "Suggested next" (Arms opens Biceps).
  const [tile, setTile] = useState<TileKey | null>(tileForCategory(params.category)?.key ?? null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CatalogExercise[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [deleting, setDeleting] = useState<CatalogExercise | null>(null);
  const deleteExercise = useDeleteExercise();
  const [ready, setReady] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  /* ---------- rows on the first frame after mount ---------- */
  // The open transition is native (UI thread), so rendering the first rows
  // during it can't make it stutter; waiting for it only delayed the list.
  // One frame first so the screen itself (search, tiles) paints immediately.
  useEffect(() => {
    perfMark("open picker", "screen mounted");
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (ready) perfEndAfterFrame("open picker");
  }, [ready]);

  /* ---------- data: everything precomputed once, rows read in O(1) ---------- */
  const { byTile, all } = useExerciseCatalog();
  // Adding to a backdated session: rows and prefill reflect history up to that date.
  const full = useExerciseIndex();
  const asOf = addMode ? (draft?.date ?? null) : null;
  const { index, summaries } = useMemo(() => indexAsOf(full.index, full.summaries, asOf), [full.index, full.summaries, asOf]);
  const todayKey = formatDate(new Date());

  const rowInfo = useMemo(() => {
    const info = new Map<string, { last: string | null; pr: boolean }>();
    for (const [key, s] of summaries) info.set(key, { last: formatSet(s.lastBest, unit), pr: prWithin(s, todayKey) });
    return info;
  }, [summaries, unit, todayKey]);

  const catalogByKey = useMemo(() => new Map(all.map((e) => [exerciseKey(e.name), e])), [all]);
  const recent = useMemo(
    () =>
      recentExercises(index, RECENT_COUNT * 2)
        // Exercises no longer in the catalog (e.g. a deleted custom one) still show under their tile.
        .map((h): CatalogExercise | null => {
          const known = catalogByKey.get(exerciseKey(h.name));
          if (known) return known;
          const t = tileForCategory(h.category); // Cardio has no tile: not loggable here
          return t ? { name: h.name, category: t.category, subgroup: t.subgroup, tile: t.key, custom: false } : null;
        })
        .filter((e): e is CatalogExercise => !!e)
        .slice(0, RECENT_COUNT),
    [index, catalogByKey],
  );

  const q = query.trim().toLowerCase();
  const items = useMemo<Item[]>(() => {
    if (q) {
      const results = all.filter((e) => e.name.toLowerCase().includes(q));
      return results.length ? [header("results", "Results", countLabel(results.length), false), ...rows("q", results)] : [];
    }
    if (tile) {
      const list = byTile.get(tile) ?? [];
      const label = PICKER_TILES.find((t) => t.key === tile)!.label;
      return [header(`h:${tile}`, label, countLabel(list.length), false), ...rows(tile, list)];
    }
    const out: Item[] = [];
    if (recent.length) out.push(header("recent", "Recent", "Last performed", false), ...rows("recent", recent));
    out.push(header("all", "All exercises", countLabel(all.length), false));
    // Each exercise once, under its first tile (an unplaced arm exercise sits under Biceps).
    for (const t of PICKER_TILES) {
      const list = all.filter((e) => e.tile === t.key);
      if (list.length) out.push(header(`h:${t.key}`, t.label, countLabel(list.length), true), ...rows(t.key, list));
    }
    return out;
  }, [q, tile, all, byTile, recent]);

  // Offsets for getItemLayout, and for each item the pinnable section header
  // it falls under (index into items, or -1), used by the pinned title bar.
  const { offsets, sectionOf } = useMemo(() => {
    const offs: number[] = [];
    const section: number[] = [];
    let y = 0;
    let current = -1;
    items.forEach((it, i) => {
      offs.push(y);
      y += it.type === "row" ? ROW_HEIGHT : HEADER_HEIGHT;
      if (it.type === "header") current = it.sticky ? i : -1;
      section.push(current);
    });
    return { offsets: offs, sectionOf: section };
  }, [items]);

  /*
   * Pinned category title. React Native's sticky headers re-position each
   * header on every scroll frame, which on Android (new architecture) made the
   * list's text look like it quivered while scrolling. Instead, one fixed title
   * bar shows the section at the top of the list and only changes when a new
   * section reaches the top: nothing moves per frame.
   */
  const [pinned, setPinned] = useState(-1);
  const pinnedRef = useRef(-1);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y - headerHeight;
      let next = -1;
      if (y >= 0 && offsets.length) {
        // Last item whose top has reached the top of the list (binary search).
        let lo = 0;
        let hi = offsets.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (offsets[mid] <= y) lo = mid;
          else hi = mid - 1;
        }
        next = sectionOf[lo] ?? -1;
      }
      if (next !== pinnedRef.current) {
        pinnedRef.current = next;
        setPinned(next);
      }
    },
    [headerHeight, offsets, sectionOf],
  );
  // A new list (category, search) starts unpinned.
  useEffect(() => {
    pinnedRef.current = -1;
    setPinned(-1);
  }, [items]);

  const getItemLayout = useCallback(
    (_: ArrayLike<Item> | null | undefined, i: number) => ({
      index: i,
      offset: headerHeight + (offsets[i] ?? 0),
      length: items[i]?.type === "row" ? ROW_HEIGHT : HEADER_HEIGHT,
    }),
    [headerHeight, offsets, items],
  );

  /* ---------- selection ---------- */
  const inSession = useMemo(() => new Set(addMode ? (draft?.exercises ?? []).map((e) => e.name.toLowerCase()) : []), [addMode, draft]);
  const pickedKeys = useMemo(() => new Set(picked.map((p) => p.name.toLowerCase())), [picked]);

  const toggle = useCallback(
    (ex: CatalogExercise) =>
      setPicked((prev) =>
        prev.some((p) => p.name.toLowerCase() === ex.name.toLowerCase()) ? prev.filter((p) => p.name.toLowerCase() !== ex.name.toLowerCase()) : [...prev, ex],
      ),
    [],
  );

  const selectTile = useCallback((key: TileKey) => {
    perfStart("category switch");
    setTile((cur) => (cur === key ? null : key));
  }, []);
  const openMenu = useCallback((ex: CatalogExercise) => setDeleting(ex), []);
  const firstCategoryRender = useRef(true);
  useEffect(() => {
    if (firstCategoryRender.current) {
      firstCategoryRender.current = false;
      return;
    }
    perfEndAfterFrame("category switch");
  }, [tile]);

  const renderItem = useCallback<ListRenderItem<Item>>(
    ({ item }) => {
      if (item.type === "header") return <SectionTitle title={item.title} right={item.right} />;
      const info = rowInfo.get(exerciseKey(item.ex.name));
      const key = item.ex.name.toLowerCase();
      return (
        <View style={{ height: ROW_HEIGHT, paddingBottom: spacing.sm }}>
          <ExerciseRow
            item={item.ex}
            last={info?.last ?? null}
            recentPR={info?.pr ?? false}
            added={pickedKeys.has(key)}
            locked={inSession.has(key)}
            onToggle={toggle}
            onMore={item.ex.customId ? openMenu : undefined}
          />
        </View>
      );
    },
    [rowInfo, pickedKeys, inSession, toggle, openMenu],
  );

  const confirm = () => {
    if (!user || picked.length === 0) return;
    const items: NewExercise[] = picked.map((p) => ({ name: p.name, category: p.category, subgroup: p.subgroup }));
    if (!addMode || !getDraft()) beginDraft(createDraft(user.uid, unit));
    updateDraft((d) => addExercises(d, items, historyPrefill(index, d.unit), { activate: addMode }));
    if (addMode) router.back();
    else router.replace("/workout/session");
  };

  // Sticky indices always describe the data actually rendered.
  const listData = ready ? items : NO_ITEMS;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  const selectedLabel = tile ? PICKER_TILES.find((t) => t.key === tile)!.label : null;

  const confirmDelete = async () => {
    const ex = deleting;
    if (!ex?.customId) return;
    try {
      await deleteExercise.mutateAsync(ex.customId);
      setPicked((prev) => prev.filter((p) => p.name.toLowerCase() !== ex.name.toLowerCase()));
      setDeleting(null);
      showToast({ type: "success", message: "Custom exercise deleted", subtitle: ex.name });
    } catch {
      setDeleting(null);
      showToast({ type: "error", message: "Couldn't delete exercise", subtitle: "Check your connection and try again." });
    }
  };

  const listHeader = (
    <View onLayout={(e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height)} style={{ gap: spacing.xl, paddingBottom: spacing.md }}>
      <Reveal index={0}>
        <SearchField value={query} onChange={setQuery} />
      </Reveal>
      {!q && (
        <Reveal index={1} style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
              Categories
            </Text>
            <Text style={[typography.labelMd, { color: selectedLabel ? colors.accent : colors.textSecondary }]}>
              {selectedLabel ? `${selectedLabel} selected` : "All"}
            </Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            {Array.from({ length: Math.ceil(PICKER_TILES.length / GRID_COLUMNS) }, (_, row) => (
              <View key={row} style={{ flexDirection: "row", gap: spacing.sm }}>
                {Array.from({ length: GRID_COLUMNS }, (_, col) => {
                  const t = PICKER_TILES[row * GRID_COLUMNS + col];
                  if (!t) return <View key={col} style={{ flex: 1 }} />;
                  return <CategoryTile key={t.key} tileKey={t.key} label={t.label} group={t.group} active={t.key === tile} onPress={selectTile} />;
                })}
              </View>
            ))}
          </View>
        </Reveal>
      )}
    </View>
  );

  const listFooter = !ready ? (
    <View style={{ gap: spacing.sm }} accessibilityLabel="Loading exercises">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <SkeletonBlock key={i} height={size.exerciseRow} radius="lg" />
      ))}
    </View>
  ) : (
    <View style={{ alignItems: "center", gap: spacing.md, paddingTop: spacing.lg }}>
      {q && items.length === 0 && <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>No exercises match</Text>}
      <Button title="Create custom exercise" icon="add-circle-outline" variant="tonal" onPress={() => setCustomOpen(true)} fullWidth />
      <Text style={[typography.labelSm, { color: colors.textSecondary, textAlign: "center" }]}>{"Can't find your variation? Add your own."}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs, gap: spacing.xs }}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: size.control, height: size.control, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialIcons name="arrow-back" size={size.iconLg} color={colors.textSecondary} />
        </Pressable>
        <Text style={[typography.headlineMd, { color: colors.text, textTransform: "uppercase" }]} accessibilityRole="header">
          {addMode ? "Add exercise" : "Log"}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
      <FlatList
        data={listData}
        keyExtractor={(it) => it.key}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        extraData={pickedKeys}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        // A wider buffer ahead of the scroll, so a fast fling never outruns the
        // rows being drawn (rows popping in looked like scattered text).
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={30}
        windowSize={11}
        // Must stay off: FlatList defaults it to true on Android, and with Fabric it
        // detached views React still expected ("addViewAt: failed to insert view").
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: (picked.length ? size.ctaTall + spacing.xl : 0) + insets.bottom + spacing.xl }}
      />
      {pinned >= 0 && items[pinned]?.type === "header" && (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.screen, backgroundColor: colors.bg }}>
          <SectionTitle title={(items[pinned] as Extract<Item, { type: "header" }>).title} right={(items[pinned] as Extract<Item, { type: "header" }>).right} />
        </View>
      )}
      </View>

      {picked.length > 0 && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.screen,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.bg,
            borderTopWidth: size.divider,
            borderTopColor: colors.border,
          }}
        >
          <Button
            title={`${countLabel(picked.length)} added · ${addMode ? "Add to workout" : "Start logging"}`}
            onPress={confirm}
            fullWidth
            haptic
            style={{ minHeight: size.ctaTall }}
          />
        </View>
      )}

      <CustomExerciseSheet
        visible={customOpen}
        initialName={query.trim()}
        tile={tile ?? PICKER_TILES[0].key}
        onClose={() => setCustomOpen(false)}
        onCreated={(ex) => {
          setCustomOpen(false);
          setQuery("");
          setTile(ex.tile);
          setPicked((prev) => [...prev, ex]);
          showToast({ type: "success", message: "Custom exercise added", subtitle: ex.name });
        }}
      />

      <Sheet
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "exercise"}?`}
        subtitle="It's removed from your exercise list. Workouts you've already logged with it stay in your history."
      >
        <View style={{ gap: spacing.sm }}>
          <Button title="Delete custom exercise" variant="destructive" onPress={() => void confirmDelete()} loading={deleteExercise.isPending} fullWidth />
          <Button title="Cancel" variant="ghost" onPress={() => setDeleting(null)} disabled={deleteExercise.isPending} fullWidth />
        </View>
      </Sheet>

      {!addMode && <ResumeWorkoutSheet from="picker" />}
    </View>
  );
}

// Pieces

const CategoryTile = memo(function CategoryTile({
  tileKey,
  label,
  group,
  active,
  onPress,
}: {
  tileKey: TileKey;
  label: string;
  group: MuscleGroup;
  active: boolean;
  onPress: (key: TileKey) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onPress(tileKey)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      accessibilityHint={active ? "Shows all exercises again" : `Shows ${label} exercises`}
      style={({ pressed }) => ({
        flex: 1,
        height: size.categoryTile,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        backgroundColor: active || pressed ? colors.surfaceContainerHigh : colors.raised,
      })}
    >
      <MuscleIcon group={group} size={size.muscleIcon} active={active} />
      <Text style={[typography.labelMd, { color: active ? colors.accent : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});

const SectionTitle = memo(function SectionTitle({ title, right }: { title: string; right?: string }) {
  const { colors } = useTheme();
  return (
    <View renderToHardwareTextureAndroid style={{ height: HEADER_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, backgroundColor: colors.bg }}>
      <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {right ? <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{right}</Text> : null}
    </View>
  );
});

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        height: size.control,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radius.lg,
        paddingLeft: spacing.md,
        backgroundColor: focused ? colors.surfaceContainerHigh : colors.raised,
      }}
    >
      <MaterialIcons name="search" size={size.icon} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search exercises"
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search exercises"
        style={[typography.bodyMd, { flex: 1, color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: 0, height: size.control }]}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={{ width: size.control, height: size.control, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialIcons name="close" size={size.icon} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

function CustomExerciseSheet({
  visible,
  initialName,
  tile: initialTile,
  onClose,
  onCreated,
}: {
  visible: boolean;
  initialName: string;
  tile: TileKey;
  onClose: () => void;
  onCreated: (ex: CatalogExercise) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tileKey, setTileKey] = useState<TileKey>(initialTile);
  const create = useCreateExercise();
  const t = PICKER_TILES.find((x) => x.key === tileKey)!;

  const [wasOpen, setWasOpen] = useState(false);
  if (visible && !wasOpen) {
    setWasOpen(true);
    setName(initialName);
    setTileKey(initialTile);
    setError(null);
  } else if (!visible && wasOpen) {
    setWasOpen(false);
  }

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name");
      return;
    }
    try {
      // Arm exercises store their sub-group ("Biceps") so they land on the right tile; workouts save "Arms".
      await create.mutateAsync({ category: t.subgroup ?? t.category, name: trimmed });
      onCreated({ name: trimmed, category: t.category, subgroup: t.subgroup, tile: t.key, custom: true });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? `You already have this exercise in ${t.label}` : "Couldn't save. Check your connection and try again.");
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Custom exercise" subtitle={`Saved to your ${t.label} list`}>
      <View style={{ gap: spacing.md }}>
        <TextField
          label="Exercise name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          error={error}
          autoFocus
          maxLength={100}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {PICKER_TILES.map((x) => (
            <CategoryChip key={x.key} label={x.label} active={x.key === tileKey} onPress={() => setTileKey(x.key)} />
          ))}
        </View>
        <Button title="Save exercise" onPress={save} loading={create.isPending} fullWidth />
      </View>
    </Sheet>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        minHeight: size.control,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        justifyContent: "center",
        backgroundColor: active ? colors.surfaceContainerHigh : colors.raised,
      }}
    >
      <Text style={[typography.labelLg, { color: active ? colors.accent : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}
