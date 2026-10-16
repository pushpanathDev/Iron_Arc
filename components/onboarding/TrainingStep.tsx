import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { GOALS } from "../../data/fitnessGoals";
import { AVOID_OPTIONS, EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS, SESSION_OPTIONS, type AvoidArea } from "../../data/trainingProfile";
import type { ProfileSetupForm, SetupField } from "../../hooks/useProfileSetupForm";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, touchTarget, typography } from "../../theme/tokens";
import { weightLabel } from "../../utils/unitConversion";
import { ChoiceChips } from "../training/ChoiceChips";
import { TrainingDaysPicker } from "../training/TrainingDaysPicker";
import { FadingMessage } from "../ui/FadingMessage";
import { PressableScale } from "../ui/PressableScale";
import { Hint, MetricField, OptionalTag, SectionCard } from "./SetupParts";

type Track = (field: SetupField) => (e: LayoutChangeEvent) => void;

/** Goal cards, two per row. */
const GOAL_ROWS = GOALS.reduce<(typeof GOALS)[]>((rows, g, i) => {
  if (i % 2 === 0) rows.push([g]);
  else rows[rows.length - 1].push(g);
  return rows;
}, []);

/** Step 2: goal, experience, training days, session length, equipment, and optional fine-tuning. */
export function TrainingStep({ form, track, fineTune, onToggleFineTune }: { form: ProfileSetupForm; track: Track; fineTune: boolean; onToggleFineTune: () => void }) {
  const { colors } = useTheme();
  const { errors } = form;
  return (
    <>
      <SectionCard
        index={0}
        title="Primary objective"
        onLayout={track("goal")}
        right={<Text style={[typography.labelSm, { color: form.goal ? colors.accent : colors.textSecondary }]}>{form.goal ? "1 selected" : "Choose one"}</Text>}
      >
        <GoalCards value={form.goal} onChange={form.setGoal} />
        <FadingMessage message={errors.goal} color={colors.danger} live />
      </SectionCard>

      <SectionCard index={1} title="Experience" onLayout={track("experience")}>
        <ChoiceChips accessibilityLabel="Training experience" options={EXPERIENCE_OPTIONS} value={form.experience} onChange={form.setExperience} />
        <Hint>Sets how hard and how fast your plan progresses.</Hint>
        <FadingMessage message={errors.experience} color={colors.danger} live />
      </SectionCard>

      <SectionCard index={2} title="Which days do you train?" onLayout={track("days")}>
        <TrainingDaysPicker value={form.days} onChange={form.setDays} />
        <Hint>Your plan, weekly goal and reminders follow these days.</Hint>
        <FadingMessage message={errors.days} color={colors.danger} live />
      </SectionCard>

      <SectionCard index={3} title="Session length">
        <ChoiceChips accessibilityLabel="Session length" options={SESSION_OPTIONS} value={form.session} onChange={form.setSession} columns={2} />
      </SectionCard>

      <SectionCard index={4} title="Equipment" onLayout={track("equipment")}>
        <ChoiceChips accessibilityLabel="Equipment" options={EQUIPMENT_OPTIONS} value={form.equipment} onChange={form.setEquipment} />
        <FadingMessage message={errors.equipment} color={colors.danger} live />
      </SectionCard>

      {/* Optional fine-tuning, collapsed */}
      <SectionCard index={5} title="Fine-tune" onLayout={track("target")} right={<OptionalTag />}>
        <PressableScale
          onPress={onToggleFineTune}
          accessibilityRole="button"
          accessibilityState={{ expanded: fineTune }}
          accessibilityLabel={fineTune ? "Hide optional settings" : "Show optional settings"}
          style={{ minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Text style={[typography.bodyMd, { color: colors.textSecondary, flex: 1 }]}>{form.showTarget ? "Body weight goal and areas to go easy on" : "Areas to go easy on"}</Text>
          <MaterialIcons name={fineTune ? "expand-less" : "expand-more"} size={size.iconLg} color={colors.textSecondary} />
        </PressableScale>
        {fineTune && (
          <View style={{ gap: spacing.md }}>
            {form.showTarget && (
              <MetricField
                label="Your body weight goal"
                value={form.target}
                onChangeText={form.setTarget}
                placeholder={form.weightUnit === "kg" ? "e.g. 72" : "e.g. 160"}
                hint="The body weight you are aiming for. It becomes your goal on the Weight page."
                suffix={weightLabel(form.weightUnit)}
                keyboardType="decimal-pad"
                returnKeyType="done"
                error={errors.target}
              />
            )}
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Go easy on</Text>
              <ChoiceChips<AvoidArea> accessibilityLabel="Areas to go easy on" multiple options={AVOID_OPTIONS} value={form.avoid} onChange={form.setAvoid} columns={2} />
              <Hint>Your plan avoids exercises that load these areas heavily.</Hint>
            </View>
          </View>
        )}
      </SectionCard>
    </>
  );
}

function GoalCards({ value, onChange }: { value: ProfileSetupForm["goal"]; onChange: ProfileSetupForm["setGoal"] }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
      {GOAL_ROWS.map((row) => (
        <View key={row[0].id} style={{ flexDirection: "row", gap: spacing.sm }}>
          {row.map((g) => {
            const selected = value === g.id;
            return (
              <PressableScale
                key={g.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onChange(g.id);
                }}
                accessibilityRole="radio"
                accessibilityLabel={`${g.title}. ${g.description}`}
                accessibilityState={{ selected }}
                style={{
                  flex: 1,
                  height: size.goalCard,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  justifyContent: "space-between",
                  backgroundColor: selected ? colors.surfaceContainerHigh : colors.surfaceContainerLowest,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <MaterialIcons name={g.icon} size={size.iconLg} color={selected ? colors.accent : colors.borderStrong} />
                  <View style={{ width: size.goalDot, height: size.goalDot, borderRadius: radius.full, backgroundColor: selected ? colors.accent : colors.surfaceContainerHighest }} />
                </View>
                <View>
                  <Text style={[typography.headlineSm, { color: selected ? colors.accent : colors.text }]}>{g.title}</Text>
                  <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={2}>
                    {g.description}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}
