import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import type { Gloss } from "../../theme/themes";

const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

/**
 * Glossy accent fill (the theme's gloss): its gradient top to bottom with a
 * soft shine over the upper half. Fills its parent, which should clip
 * (`overflow: "hidden"`) to its rounded corners.
 */
export function GlossFill({ gloss }: { gloss: Gloss }) {
  // Always one location per colour: Android keeps the previous theme's locations
  // when they're left out, and a count that doesn't match the colours leaves the
  // old gradient drawn. The key gives each theme's gradient a fresh view too.
  const locations = gloss.locations ?? gloss.stops.map((_, i) => i / (gloss.stops.length - 1));
  return (
    <View pointerEvents="none" style={FILL}>
      <LinearGradient key={gloss.stops.join()} colors={gloss.stops as [string, string, ...string[]]} locations={locations as [number, number, ...number[]]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={FILL} />
      <LinearGradient colors={[gloss.shine, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }} style={FILL} />
    </View>
  );
}
