import { memo } from "react";
import Svg, { Circle, Path, Polyline } from "react-native-svg";
import { useTheme } from "../../theme/theme";
import {
  HEAD,
  HEART_PATH,
  MUSCLE_ICONS,
  muscleGroupForCategory,
  PULSE_POINTS,
  SILHOUETTE,
  toPath,
  VIEWBOX,
  type MuscleGroup,
} from "./musclePaths";

export type MuscleIconProps = {
  /** Icon group, or pass `category` (backend/app category name) instead. */
  group?: MuscleGroup;
  category?: string | null;
  size?: number;
  /** Target muscle in the muscle coral when active, onSurfaceVariant otherwise. */
  active?: boolean;
};

const SILHOUETTE_PATHS = SILHOUETTE.map(toPath);
const ICON_PATHS = Object.fromEntries(
  Object.entries(MUSCLE_ICONS).map(([k, spec]) => [k, spec.kind === "body" ? spec.muscles.map(toPath) : []]),
) as Record<MuscleGroup, string[]>;

/** Body-part icon: simplified silhouette (outlineVariant) with the target muscles in coral. */
export const MuscleIcon = memo(function MuscleIcon({ group, category, size = 32, active = false }: MuscleIconProps) {
  const { colors } = useTheme();
  const g = group ?? muscleGroupForCategory(category);
  const spec = MUSCLE_ICONS[g];
  // One fixed coral for "this muscle" everywhere (the body map scales the same family by sets).
  const highlight = active ? colors.muscleTarget : colors.textSecondary;
  const silhouette = colors.border; // outlineVariant

  if (spec.kind === "cardio") {
    return (
      <Svg width={size} height={size} viewBox={VIEWBOX} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Path d={HEART_PATH} fill={highlight} />
        <Polyline points={PULSE_POINTS} fill="none" stroke={silhouette} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    );
  }

  const body = spec.whole ? highlight : silhouette;
  return (
    <Svg width={size} height={size} viewBox={VIEWBOX} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={body} />
      {SILHOUETTE_PATHS.map((d, i) => (
        <Path key={`s${i}`} d={d} fill={body} stroke={body} strokeWidth={1.2} strokeLinejoin="round" />
      ))}
      {ICON_PATHS[g].map((d, i) => (
        <Path key={`m${i}`} d={d} fill={highlight} stroke={highlight} strokeWidth={0.6} strokeLinejoin="round" />
      ))}
    </Svg>
  );
});

export { muscleGroupForCategory, type MuscleGroup } from "./musclePaths";
