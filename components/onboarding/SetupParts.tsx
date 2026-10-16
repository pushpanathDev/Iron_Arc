import type { ReactNode, Ref } from "react";
import { Text, TextInput, View, type KeyboardTypeOptions, type LayoutChangeEvent } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { FadingMessage } from "../ui/FadingMessage";
import { Reveal } from "../ui/Reveal";

/* Building blocks of the profile setup steps. */

export function SectionCard({
  title,
  right,
  children,
  onLayout,
  index = 0,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Entrance order (cards rise in one after another). */
  index?: number;
}) {
  const { colors } = useTheme();
  return (
    // Reveal carries onLayout so scroll-to-field still gets the card's position in the form.
    <Reveal index={index} onLayout={onLayout} style={{ backgroundColor: colors.raised, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
        <Text accessibilityRole="header" style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </Reveal>
  );
}

/** "Optional" beside a card title. */
export function OptionalTag() {
  const { colors } = useTheme();
  return <Text style={[typography.labelSm, { color: colors.borderStrong }]}>Optional</Text>;
}

/** One line of quiet help text under a field. */
export function Hint({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[typography.labelSm, { color: colors.borderStrong }]}>{children}</Text>;
}

export function MetricField({
  label,
  value,
  onChangeText,
  placeholder,
  suffix,
  keyboardType = "default",
  error,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string | null;
  inputRef?: Ref<TextInput>;
  returnKeyType?: "next" | "done";
  onSubmitEditing?: () => void;
  autoComplete?: "name" | "off";
  /** One line under the field explaining what it is. */
  hint?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs, flex: 1 }}>
      <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{label}</Text>
      <View
        style={{
          height: size.control,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceContainerLowest,
          paddingHorizontal: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          borderWidth: error ? size.divider : 0,
          borderColor: colors.danger,
        }}
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.borderStrong}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoComplete={autoComplete}
          accessibilityLabel={suffix ? `${label} in ${suffix}` : label}
          accessibilityHint={error ?? undefined}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          style={[typography.headlineSm, { flex: 1, height: size.control, color: colors.text, paddingVertical: 0 }]}
        />
        {suffix && <Text style={[typography.labelSm, { color: colors.borderStrong }]}>{suffix}</Text>}
      </View>
      {hint ? <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{hint}</Text> : null}
      <FadingMessage message={error} color={colors.danger} live />
    </View>
  );
}

/** "Step 1 of 2" as two bars. */
export function StepDots({ step }: { step: 1 | 2 }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`Step ${step} of 2`} style={{ flexDirection: "row", gap: spacing.xs, paddingBottom: spacing.xs }}>
      {[1, 2].map((n) => (
        <View key={n} style={{ flex: 1, height: size.progressBar, borderRadius: radius.full, backgroundColor: n <= step ? colors.accent : colors.surfaceContainerHighest }} />
      ))}
    </View>
  );
}
