import { size, spacing } from "../../theme/tokens";
import { exerciseKey, recentExercises, type ExerciseHistory } from "../../utils/exerciseHistory";
import { PICKER_TILES, tileForCategory, type CatalogExercise, type TileKey } from "../../data/pickerTiles";

/*
 * What the exercise picker's list shows: section titles and exercise rows for
 * a search, one category, or everything (Recent first). Pure, so the screen
 * only renders it.
 */

/** Fixed heights, so the list never measures rows (getItemLayout). */
export const ROW_HEIGHT = size.exerciseRow + spacing.sm;
export const HEADER_HEIGHT = size.control;
const RECENT_COUNT = 5;

export type PickerItem =
  | { type: "header"; key: string; title: string; right?: string; sticky: boolean }
  | { type: "row"; key: string; ex: CatalogExercise };
export const countLabel = (n: number) => `${n} ${n === 1 ? "exercise" : "exercises"}`;
const header = (key: string, title: string, right: string | undefined, sticky: boolean): PickerItem => ({ type: "header", key, title, right, sticky });
const rows = (prefix: string, list: CatalogExercise[]): PickerItem[] => list.map((ex) => ({ type: "row", key: `${prefix}:${ex.name}`, ex }));

/** The last few exercises performed, as catalog entries (a deleted custom one still shows under its tile). */
export function recentPickerExercises(index: Map<string, ExerciseHistory>, catalogByKey: Map<string, CatalogExercise>): CatalogExercise[] {
  return recentExercises(index, RECENT_COUNT * 2)
    .map((h): CatalogExercise | null => {
      const known = catalogByKey.get(exerciseKey(h.name));
      if (known) return known;
      const t = tileForCategory(h.category); // Cardio has no tile: not loggable here
      return t ? { name: h.name, category: t.category, subgroup: t.subgroup, tile: t.key, custom: false } : null;
    })
    .filter((e): e is CatalogExercise => !!e)
    .slice(0, RECENT_COUNT);
}

export function buildPickerItems({
  query,
  tile,
  all,
  byTile,
  recent,
}: {
  /** Trimmed, lower-case search text ("" when not searching). */
  query: string;
  tile: TileKey | null;
  all: CatalogExercise[];
  byTile: Map<TileKey, CatalogExercise[]>;
  recent: CatalogExercise[];
}): PickerItem[] {
  if (query) {
    const results = all.filter((e) => e.name.toLowerCase().includes(query));
    return results.length ? [header("results", "Results", countLabel(results.length), false), ...rows("q", results)] : [];
  }
  if (tile) {
    const list = byTile.get(tile) ?? [];
    const label = PICKER_TILES.find((t) => t.key === tile)!.label;
    return [header(`h:${tile}`, label, countLabel(list.length), false), ...rows(tile, list)];
  }
  const out: PickerItem[] = [];
  if (recent.length) out.push(header("recent", "Recent", "Last performed", false), ...rows("recent", recent));
  out.push(header("all", "All exercises", countLabel(all.length), false));
  // Each exercise once, under its first tile (an unplaced arm exercise sits under Biceps).
  for (const t of PICKER_TILES) {
    const list = all.filter((e) => e.tile === t.key);
    if (list.length) out.push(header(`h:${t.key}`, t.label, countLabel(list.length), true), ...rows(t.key, list));
  }
  return out;
}
