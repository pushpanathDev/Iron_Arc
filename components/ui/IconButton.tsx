import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size } from "../../theme/tokens";
import type { MaterialIconName } from "./iconName";

/**
 * Round icon button, a full 48dp touch target with a soft fill while pressed.
 * `strong` is for navigation (back, calendar arrows): larger and in the text
 * colour. The default is quieter, for menus and secondary actions.
 */
export function IconButton({ icon, label, onPress, strong, disabled }: { icon: MaterialIconName; label: string; onPress: () => void; strong?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({ width: size.control, height: size.control, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
    >
      <MaterialIcons name={icon} size={strong ? size.iconLg : size.icon} color={disabled ? colors.textMuted : strong ? colors.text : colors.textSecondary} />
    </Pressable>
  );
}

/** The header's back arrow. */
export function BackButton() {
  return <IconButton icon="arrow-back" label="Back" strong onPress={() => router.back()} />;
}
