import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

export type ChoiceOption<T extends string | number> = { value: T; label: string; hint?: string };

type Single<T extends string | number> = { multiple?: false; value: T | null; onChange: (value: T) => void };
type Multi<T extends string | number> = { multiple: true; value: T[]; onChange: (value: T[]) => void };

export type ChoiceChipsProps<T extends string | number> = (Single<T> | Multi<T>) & {
  options: ChoiceOption<T>[];
  /** Columns; options wrap into rows of this many (equal widths). */
  columns?: number;
  accessibilityLabel: string;
};

/**
 * Option tiles for the training profile: one choice (radio) or several
 * (checkbox). Each tile is the whole tap target (48px min), with an optional
 * hint line under the label.
 */
export function ChoiceChips<T extends string | number>(props: ChoiceChipsProps<T>) {
  const { colors } = useTheme();
  const { options, columns = options.length, accessibilityLabel } = props;
  const isOn = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);
  const press = (v: T) => {
    Haptics.selectionAsync().catch(() => {});
    if (props.multiple) props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    else props.onChange(v);
  };

  const rows: ChoiceOption<T>[][] = [];
  options.forEach((o, i) => {
    if (i % columns === 0) rows.push([]);
    rows[rows.length - 1].push(o);
  });

  return (
    <View accessibilityRole={props.multiple ? undefined : "radiogroup"} accessibilityLabel={accessibilityLabel} style={{ gap: spacing.sm }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: spacing.sm }}>
          {row.map((o) => {
            const on = isOn(o.value);
            return (
              <Pressable
                key={String(o.value)}
                onPress={() => press(o.value)}
                accessibilityRole={props.multiple ? "checkbox" : "radio"}
                accessibilityState={props.multiple ? { checked: on } : { selected: on }}
                accessibilityLabel={o.hint ? `${o.label}. ${o.hint}` : o.label}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: size.control,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  justifyContent: "center",
                  alignItems: "center",
                  gap: spacing.xxs,
                  backgroundColor: on ? colors.surfaceContainerHigh : pressed ? colors.surfaceContainerHigh : colors.surfaceContainerLowest,
                  borderWidth: size.divider,
                  borderColor: on ? colors.accent : "transparent",
                })}
              >
                <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  {props.multiple && on && <MaterialIcons name="check" size={size.iconXs} color={colors.accent} />}
                  <Text style={[typography.labelLg, { color: on ? colors.accent : colors.text, textAlign: "center" }]} numberOfLines={1}>
                    {o.label}
                  </Text>
                </View>
                {o.hint && (
                  <Text pointerEvents="none" style={[typography.labelSm, { color: colors.textSecondary, textAlign: "center" }]} numberOfLines={2}>
                    {o.hint}
                  </Text>
                )}
              </Pressable>
            );
          })}
          {/* Keep tile widths equal on a short last row. */}
          {row.length < columns && Array.from({ length: columns - row.length }, (_, i) => <View key={`pad${i}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}
