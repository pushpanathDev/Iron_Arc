import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useThemeContext } from "../../providers/ThemeContext";
import { ACCENT_PREVIEWS, type AccentPreview } from "../../theme/accentPreviews";
import { useTheme } from "../../theme/theme";
import { darkColors, radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { GlossFill } from "../ui/GlossFill";

const ROWS: { style: AccentPreview["style"]; title: string }[] = [
  { style: "flat", title: "Flat" },
  { style: "glossy", title: "Glossy" },
];

/** Development builds only: try each accent palette, flat or glossy, across the whole app. */
export function AccentPreviewPicker() {
  const { colors } = useTheme();
  const { accentPreview, setAccentPreview } = useThemeContext();
  return (
    <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised }}>
      <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>Accent colour (testing)</Text>
      {ROWS.map((row) => (
        <View key={row.style} style={{ gap: spacing.sm }}>
          <Text style={[typography.labelSm, { color: colors.textMuted }]}>{row.title}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {ACCENT_PREVIEWS.filter((p) => p.style === row.style).map((p) => (
              <Swatch key={p.key} preview={p} on={p.key === accentPreview} onPress={() => setAccentPreview(p.key)} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function Swatch({ preview: p, on, onPress }: { preview: AccentPreview; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${p.label}${p.style === "glossy" ? ", glossy" : ""}`}
      style={{ alignItems: "center", gap: spacing.xs, minWidth: size.control }}
    >
      <View
        style={{
          width: size.control,
          height: size.control,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: p.swatch,
          borderWidth: on ? size.divider * 2 : 0,
          borderColor: colors.text,
        }}
      >
        {p.gloss && <GlossFill gloss={p.gloss} accent={p.swatch} />}
        {on && <MaterialIcons name="check" size={size.icon} color={p.colors?.onAccent ?? darkColors.onAccent} />}
      </View>
      <Text style={[typography.labelSm, { color: on ? colors.text : colors.textSecondary }]}>{p.label}</Text>
    </Pressable>
  );
}
