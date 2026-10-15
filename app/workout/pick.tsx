import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View, type LayoutChangeEvent, type ListRenderItem } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../providers/AuthContext";
import { CategoryTile } from "../../components/workout/CategoryTile";
import { CustomExerciseSheet } from "../../components/workout/CustomExerciseSheet";
import { ExerciseRow } from "../../components/workout/ExerciseRow";
import { ResumeWorkoutSheet } from "../../components/workout/ResumeWorkoutSheet";
import { SearchField } from "../../components/workout/SearchField";
import { SectionTitle } from "../../components/workout/SectionTitle";
import { buildPickerItems, countLabel, recentPickerExercises, ROW_HEIGHT, type PickerItem } from "../../components/workout/pickerList";
import { Button } from "../../components/ui/Button";
import { Reveal } from "../../components/ui/Reveal";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { useToast } from "../../providers/ToastContext";
import { addExercises, beginDraft, createDraft, getDraft, updateDraft, useWorkoutDraft, type NewExercise } from "../../hooks/workoutDraft";
import { useDeleteExercise } from "../../hooks/useExercises";
import { PICKER_TILES, tileForCategory, type CatalogExercise, type TileKey } from "../../data/pickerTiles";
import { historyPrefill, useExerciseCatalog, useExerciseIndex } from "../../hooks/useWorkoutData";
import { usePinnedSection } from "../../hooks/usePinnedSection";
import { useUnitPreference } from "../../hooks/useUnitPreference";
import { useTheme } from "../../theme/theme";
import { size, spacing, typography } from "../../theme/tokens";
import { exerciseKey, formatSet, indexAsOf, prWithin } from "../../utils/exerciseHistory";
import { perfEndAfterFrame, perfMark, perfStart } from "../../utils/perf";
import { formatDate } from "../../utils/weekUtils";

const GRID_COLUMNS = 3;
const SKELETON_ROWS = 5;
const NO_ITEMS: PickerItem[] = [];

/** Pick exercises to start a session, or (mode=add) to add to the one in progress. */
export default function ExercisePicker() {
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

  // Rows on the first frame after mount
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

  // Data: everything precomputed once, rows read in O(1)
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
  const recent = useMemo(() => recentPickerExercises(index, catalogByKey), [index, catalogByKey]);

  const q = query.trim().toLowerCase();
  const items = useMemo(() => buildPickerItems({ query: q, tile, all, byTile, recent }), [q, tile, all, byTile, recent]);
  const { pinnedHeader, onScroll, getItemLayout } = usePinnedSection(items, headerHeight);

  // Selection
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

  const renderItem = useCallback<ListRenderItem<PickerItem>>(
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
        {pinnedHeader && (
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.screen, backgroundColor: colors.bg }}>
            <SectionTitle title={pinnedHeader.title} right={pinnedHeader.right} />
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
