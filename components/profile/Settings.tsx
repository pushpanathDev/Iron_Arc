import { MaterialIcons } from "@expo/vector-icons";
import { Children, Fragment, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

/** Titled card of rows separated by hairlines (Profile & Settings mockup). */
export function SettingsGroup({ title, note, children }: { title?: string; note?: string; children: ReactNode }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: spacing.xs }}>
          <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]} accessibilityRole="header">
            {title}
          </Text>
          {note ? <Text style={[typography.labelSm, { color: colors.textMuted }]}>{note}</Text> : null}
        </View>
      ) : null}
      <View style={{ backgroundColor: colors.raised, borderRadius: radius.xl, overflow: "hidden" }}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={{ height: size.divider, marginLeft: spacing.lg + size.rowIcon + spacing.md, backgroundColor: colors.surfaceContainerHigh }} />}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export type SettingsRowProps = {
  icon: IconName;
  label: string;
  /** Second line under the label. */
  detail?: string;
  /** Current value on the right ("Mon, Wed, Fri", "178 cm"); "Add" style when `missing`. */
  value?: string;
  missing?: boolean;
  /** Custom right side (e.g. a kg/lb switch); replaces value + chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** "navigate" opens another screen (chevron); "edit" opens a sheet here (value only); "action" runs something (no chevron). */
  kind?: "navigate" | "edit" | "action";
  tone?: "default" | "danger";
  busy?: boolean;
  /** Greyed out and not tappable (e.g. reminders while notifications are off). */
  disabled?: boolean;
  /** A switch row: announced as a switch with this state. */
  checked?: boolean;
  accessibilityHint?: string;
};

/** One setting: icon tile, label (+ detail), value and chevron. The whole row takes the tap. */
export function SettingsRow({ icon, label, detail, value, missing, trailing, onPress, kind = "navigate", tone = "default", busy, disabled, checked, accessibilityHint }: SettingsRowProps) {
  const { colors } = useTheme();
  const danger = tone === "danger";
  const content = (
    <>
      <View
        style={{
          width: size.rowIcon,
          height: size.rowIcon,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: danger ? colors.dangerSubtle : colors.surfaceContainerHigh,
        }}
      >
        <MaterialIcons name={icon} size={size.icon} color={danger ? colors.danger : colors.accent} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={[typography.bodyMdMedium, { color: danger ? colors.danger : colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        <>
          {value ? (
            <Text style={[typography.labelLg, { flexShrink: 1, maxWidth: "45%", textAlign: "right", color: missing ? colors.accent : colors.textSecondary }]} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {busy ? (
            <ActivityIndicator size="small" color={danger ? colors.danger : colors.accent} />
          ) : onPress && kind === "navigate" && !disabled ? (
            <MaterialIcons name="chevron-right" size={size.iconSm} color={colors.textMuted} />
          ) : null}
        </>
      )}
    </>
  );
  const style = {
    minHeight: size.exerciseRow,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    opacity: disabled ? 0.45 : 1,
  };
  // Rows with their own control (kg/lb switch) and no row action stay plain views.
  if (!onPress) {
    return (
      <View style={style} accessible={!trailing} accessibilityLabel={`${label}${value ? `: ${value}` : ""}`}>
        {content}
      </View>
    );
  }
  const isSwitch = checked !== undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole={isSwitch ? "switch" : "button"}
      accessibilityState={isSwitch ? { checked, disabled } : { disabled }}
      accessibilityLabel={`${label}${value ? `: ${value}` : ""}${detail ? `. ${detail}` : ""}`}
      accessibilityHint={accessibilityHint ?? (kind === "edit" ? "Opens an editor" : undefined)}
      style={({ pressed }) => [style, { backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" }]}
    >
      {content}
    </Pressable>
  );
}
