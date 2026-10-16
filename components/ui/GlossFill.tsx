import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import type { Gloss } from "../../theme/accentPreviews";

const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

/**
 * Glossy accent fill (accent preview testing): a light-to-deep gradient with a
 * soft shine over the upper half. Fills its parent, which should clip
 * (`overflow: "hidden"`) to its rounded corners.
 */
export function GlossFill({ gloss, accent, pressed = false }: { gloss: Gloss; accent: string; pressed?: boolean }) {
  return (
    <View pointerEvents="none" style={FILL}>
      <LinearGradient colors={pressed ? [accent, gloss.bottom] : [gloss.top, accent, gloss.bottom]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={FILL} />
      {!pressed && <LinearGradient colors={[gloss.shine, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }} style={FILL} />}
    </View>
  );
}
