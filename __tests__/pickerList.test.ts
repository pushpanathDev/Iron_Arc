import { buildPickerItems, type PickerItem } from "../components/workout/pickerList";
import type { CatalogExercise, TileKey } from "../data/pickerTiles";

const ex = (name: string, tile: TileKey): CatalogExercise => ({ name, category: "Chest", tile, custom: false });
const bench = ex("Bench Press", "chest");
const fly = ex("Pec Fly", "chest");
const row = ex("Barbell Row", "back");
const all = [bench, fly, row];
const byTile = new Map<TileKey, CatalogExercise[]>([
  ["chest", [bench, fly]],
  ["back", [row]],
]);

const shape = (items: PickerItem[]) => items.map((i) => (i.type === "header" ? `# ${i.title} (${i.right ?? ""})` : i.ex.name));

describe("buildPickerItems", () => {
  it("search shows matching exercises under Results", () => {
    expect(shape(buildPickerItems({ query: "bench", tile: null, all, byTile, recent: [] }))).toEqual(["# Results (1 exercise)", "Bench Press"]);
  });

  it("search with no match shows nothing (the screen says 'No exercises match')", () => {
    expect(buildPickerItems({ query: "squat", tile: null, all, byTile, recent: [] })).toEqual([]);
  });

  it("a category shows just its exercises", () => {
    expect(shape(buildPickerItems({ query: "", tile: "chest", all, byTile, recent: [] }))).toEqual(["# Chest (2 exercises)", "Bench Press", "Pec Fly"]);
  });

  it("no filter: Recent first, then every exercise once under its category", () => {
    const items = buildPickerItems({ query: "", tile: null, all, byTile, recent: [row] });
    expect(shape(items)).toEqual(["# Recent (Last performed)", "Barbell Row", "# All exercises (3 exercises)", "# Chest (2 exercises)", "Bench Press", "Pec Fly", "# Back (1 exercise)", "Barbell Row"]);
    // Category titles can be pinned at the top while scrolling; Recent and All can't.
    expect(items.filter((i) => i.type === "header" && i.sticky).map((i) => (i.type === "header" ? i.title : ""))).toEqual(["Chest", "Back"]);
  });
});
