import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useThemeContext } from "../../providers/ThemeContext";
import { colorsFor, useTheme } from "../../theme/theme";
import { THEMES, type AppTheme } from "../../theme/themes";
import { motion, radius, size, spacing, typography } from "../../theme/tokens";
import { GlossFill } from "../ui/GlossFill";
import { SettingsRow } from "./Settings";

const SWATCH = 36;

/** Profile → Theme: a row showing the current theme that opens the swatches in place. Picking one applies it straight away. */
export function ThemePicker() {
  const { colors } = useTheme();
  const { theme, setTheme } = useThemeContext();
  const [open, setOpen] = useState(false);
  const current = THEMES.find((t) => t.key === theme) ?? THEMES[0];

  return (
    <View>
      <SettingsRow
        icon="palette"
        label="Theme"
        onPress={() => setOpen((o) => !o)}
        accessibilityHint={open ? "Hides the themes" : "Shows the themes"}
        value={current.label}
        trailing={
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ width: size.statusDot + spacing.xs, height: size.statusDot + spacing.xs, borderRadius: radius.full, backgroundColor: colors.accent }} />
            <Text style={[typography.labelLg, { color: colors.textSecondary }]}>{current.label}</Text>
            <MaterialIcons name={open ? "expand-less" : "expand-more"} size={size.iconSm} color={colors.textMuted} />
          </View>
        }
      />
      {open && (
        <Animated.View
          entering={FadeIn.duration(motion.slideMs)}
          exiting={FadeOut.duration(motion.slideMs)}
          accessibilityRole="radiogroup"
          style={{ flexDirection: "row", paddingHorizontal: spacing.sm, paddingBottom: spacing.md }}
        >
          {THEMES.map((t) => (
            <Swatch key={t.key} theme={t} on={t.key === theme} onPress={() => setTheme(t.key)} />
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function Swatch({ theme, on, onPress }: { theme: AppTheme; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const own = colorsFor(theme.key);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${theme.label} theme`}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
    >
      <View
        style={{
          width: SWATCH,
          height: SWATCH,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: own.accent,
          borderWidth: on ? size.divider * 2 : 0,
          borderColor: colors.text,
        }}
      >
        <GlossFill gloss={theme.gloss} />
        {on && <MaterialIcons name="check" size={size.iconSm} color={own.onAccent} />}
      </View>
      <Text style={[typography.labelSm, { color: on ? colors.text : colors.textSecondary, textAlign: "center" }]} numberOfLines={2}>
        {theme.label}
      </Text>
    </Pressable>
  );
}
