import * as Haptics from "expo-haptics";
import { useRef } from "react";
import { Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import type { ProfileSetupForm, SetupField } from "../../hooks/useProfileSetupForm";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, touchTarget, typography } from "../../theme/tokens";
import { weightLabel } from "../../utils/unitConversion";
import { PressableScale } from "../ui/PressableScale";
import type { HeightUnit } from "../../utils/height";
import { HeightRuler } from "./HeightRuler";
import { Hint, MetricField, OptionalTag, SectionCard } from "./SetupParts";

type Track = (field: SetupField, also?: SetupField) => (e: LayoutChangeEvent) => void;

/** Step 1: name, age, height and (optionally) weight. */
export function AboutYouStep({ form, track }: { form: ProfileSetupForm; track: Track }) {
  const ageRef = useRef<TextInput>(null);
  return (
    <>
      <SectionCard index={0} title="Athlete identity" onLayout={track("name", "age")}>
        <MetricField
          label="Display name"
          value={form.name}
          onChangeText={form.setName}
          placeholder="Your name"
          autoComplete="name"
          returnKeyType="next"
          onSubmitEditing={() => ageRef.current?.focus()}
          error={form.errors.name}
        />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <MetricField
            label="Age"
            inputRef={ageRef}
            value={form.age}
            onChangeText={form.setAge}
            placeholder="Age"
            suffix="yrs"
            keyboardType="number-pad"
            returnKeyType="done"
            error={form.errors.age}
          />
          <View style={{ flex: 1 }} />
        </View>
      </SectionCard>

      <SectionCard index={1} title="Stature" right={<HeightUnitToggle value={form.heightUnit} onChange={form.setHeightUnit} />}>
        {/* The drum shows its own reading; the form only updates when it settles. */}
        <HeightRuler cm={form.heightCm} unit={form.heightUnit} onChangeCm={form.setHeightCm} />
        <Hint>Used to tune your plans and stats.</Hint>
      </SectionCard>

      <SectionCard index={2} title="Weight" onLayout={track("weight")} right={<OptionalTag />}>
        <MetricField
          label="Current weight"
          value={form.weight}
          onChangeText={form.setWeight}
          placeholder={form.weightUnit === "kg" ? "e.g. 78.5" : "e.g. 173"}
          suffix={weightLabel(form.weightUnit)}
          keyboardType="decimal-pad"
          returnKeyType="done"
          error={form.errors.weight}
        />
        <Hint>You can log this anytime in the Weight tab.</Hint>
      </SectionCard>
    </>
  );
}

/** cm / ft-in switch beside the "Stature" title. */
function HeightUnitToggle({ value, onChange }: { value: HeightUnit; onChange: (u: HeightUnit) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ height: size.linkMin, padding: spacing.xxs, borderRadius: radius.md, flexDirection: "row", backgroundColor: colors.surfaceContainerLowest }}>
      {(["cm", "ft"] as HeightUnit[]).map((u) => {
        const active = value === u;
        return (
          <PressableScale
            key={u}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(u);
            }}
            hitSlop={{ top: (touchTarget - size.linkMin) / 2, bottom: (touchTarget - size.linkMin) / 2 }}
            accessibilityRole="radio"
            accessibilityLabel={u === "cm" ? "Centimetres" : "Feet and inches"}
            accessibilityState={{ selected: active }}
            style={{ height: "100%", paddingHorizontal: spacing.md, borderRadius: radius.sm, justifyContent: "center", backgroundColor: active ? colors.surfaceContainerHigh : "transparent" }}
          >
            <Text style={[typography.labelSm, { color: active ? colors.accent : colors.borderStrong }]}>{u === "cm" ? "cm" : "ft-in"}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
