import { Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Svg, { Line, Rect, G } from "react-native-svg";
import { useTheme } from "../../src/theme/theme";

export type WeeklyWorkoutBar = {
  weekStart: string;
  weekLabel: string;
  monthLabel: string;
  workouts: number;
  isCurrentWeek: boolean;
};

type Props = {
  data: WeeklyWorkoutBar[];
  onBarPress?: (item: WeeklyWorkoutBar) => void;
};

export default function WorkoutBarChart({ data, onBarPress }: Props) {
  const { colors, spacing, radius } = useTheme();

  if (!data || data.length === 0) return null;

  const BAR_WIDTH = 18;
  const BAR_GAP = 10;
  const CHART_HEIGHT = 140;
  const BAR_AREA_HEIGHT = CHART_HEIGHT - 30;

  const maxValue = Math.max(...data.map((d) => d.workouts), 1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
      }}
    >
      <View>
        <Svg
          height={CHART_HEIGHT}
          width={data.length * (BAR_WIDTH + BAR_GAP)}
        >
          {data.map((week, index) => {
            const barHeight =
              (week.workouts / maxValue) * BAR_AREA_HEIGHT;

            const x = index * (BAR_WIDTH + BAR_GAP);
            const y = CHART_HEIGHT - barHeight;

            const fillColor = week.isCurrentWeek
              ? colors.accent
              : `${colors.accent}55`; // muted past weeks

            return (
              <G key={week.weekStart}>
                {/* WEEK BAR */}
                <Rect
                  x={x}
                  y={y}
                  width={BAR_WIDTH}
                  height={barHeight}
                  rx={radius.sm}
                  fill={fillColor}
                  onPress={() => onBarPress?.(week)}
                />

                {/* MONTH DIVIDER AFTER EVERY 4 WEEKS */}
                {(index + 1) % 4 === 0 && (
                  <Line
                    x1={x + BAR_WIDTH + BAR_GAP / 2}
                    y1={10}
                    x2={x + BAR_WIDTH + BAR_GAP / 2}
                    y2={CHART_HEIGHT - 10}
                    stroke={colors.textSecondary}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                )}
              </G>
            );
          })}
        </Svg>

        {/* MONTH LABELS */}
        <View
          style={{
            flexDirection: "row",
            marginTop: spacing.xs,
          }}
        >
          {data.map((week, index) => {
            if ((index + 1) % 4 !== 0) return null;

            return (
              <View
                key={`month-${week.weekStart}`}
                style={{
                  width: 4 * (BAR_WIDTH + BAR_GAP),
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                  }}
                >
                  {week.monthLabel}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
