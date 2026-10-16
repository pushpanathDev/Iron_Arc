import { MaterialIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Toggle } from "../ui/Toggle";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import type { MaterialIconName } from "../ui/iconName";

/** A reminder type: icon, title, description and switch; its settings show while it's on. */
export function SectionCard({
  icon,
  title,
  description,
  on,
  onToggle,
  onFocus,
  focused,
  alwaysOpen,
  children,
}: {
  icon: MaterialIconName;
  title: string;
  description: string;
  on: boolean;
  onToggle: () => void;
  onFocus: () => void;
  focused: boolean;
  alwaysOpen?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const open = on || alwaysOpen;
  return (
    <View style={{ borderRadius: radius.xl, backgroundColor: colors.raised, borderWidth: 1, borderColor: focused ? colors.accentSubtle : "transparent", overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
        <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
          <MaterialIcons name={icon} size={size.icon} color={on ? colors.accent : colors.textSecondary} />
        </View>
        {/* Tapping the text previews this reminder */}
        <Pressable onPress={onFocus} accessibilityRole="button" accessibilityLabel={`${title}. ${description}`} accessibilityHint="Shows it in the preview" style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}>{title}</Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{description}</Text>
        </Pressable>
        <Toggle value={on} onChange={onToggle} accessibilityLabel={title} />
      </View>
      {open && <View style={{ gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.md, borderTopWidth: size.divider, borderTopColor: colors.surfaceContainerHigh }}>{children}</View>}
    </View>
  );
}

export function SubLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>{children}</Text>;
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={spacing.sm} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Text style={[typography.labelLg, { color: colors.accent }]}>{title}</Text>
    </Pressable>
  );
}

/** Label on the left, control on the right. */
export function ValueRow({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ minHeight: size.control, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
      <Text style={[typography.bodyMd, { flex: 1, color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

/** Checkbox row; the whole row takes the tap. */
export function CheckRow({ label, detail, checked, disabled, onToggle, trailing }: { label: string; detail: string; checked: boolean; disabled?: boolean; onToggle: () => void; trailing?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, opacity: disabled ? 0.45 : 1 }}>
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={`${label}. ${detail}`}
        style={{ flex: 1, minHeight: size.control, flexDirection: "row", alignItems: "center", gap: spacing.md }}
      >
        <MaterialIcons name={checked ? "check-box" : "check-box-outline-blank"} size={size.iconLg} color={checked ? colors.accent : colors.textMuted} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{label}</Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{detail}</Text>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}
