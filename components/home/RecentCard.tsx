import { router } from "expo-router";
import { Text, View } from "react-native";
import { MuscleIcon } from "../muscle/MuscleIcon";
import { PressableScale } from "../ui";
import type { Session } from "../../hooks/useWorkoutSummary";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import { displayWeight, weightLabel } from "../../utils/unitConversion";
import { useCountUp, sessionName, relativeDay } from "./homeShared";

export function RecentCard({ session, unit, todayKey }: { session: Session; unit: "kg" | "lbs"; todayKey: string }) {
  const { colors } = useTheme();
  const volume = useCountUp(Math.round(displayWeight(session.volumeKg, unit)), true);
  const day = relativeDay(session.date, todayKey);
  const count = `${session.exercises.length} ${session.exercises.length === 1 ? "exercise" : "exercises"}`;
  const name = sessionName(session);

  return (
    <PressableScale
      onPress={() => router.navigate("/(tabs)/history")}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${day}, ${count}${session.volumeKg > 0 ? `, total volume ${volume} ${weightLabel(unit)}` : ""}`}
      accessibilityHint="Opens History"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
      })}
    >
      <View
        style={{
          width: size.rowIcon,
          height: size.rowIcon,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceContainerHigh,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MuscleIcon category={session.mainCategory} size={size.muscleIcon} active />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyMdMedium, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
          {day} · {count}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        {session.volumeKg > 0 ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
              <Text style={[typography.headlineSm, { color: colors.text }]}>{volume.toLocaleString()}</Text>
              <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{weightLabel(unit)}</Text>
            </View>
            <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Total volume</Text>
          </>
        ) : (
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
            {session.sets} {session.sets === 1 ? "set" : "sets"}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}
