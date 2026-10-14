import { Switch } from "react-native";
import { useTheme } from "../../theme/theme";

/** Themed on/off switch. Put it in a row that also toggles, so the whole row takes the tap. */
export function Toggle({ value, onChange, disabled, accessibilityLabel }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: colors.surfaceContainerHighest, true: colors.accent }}
      thumbColor={value ? colors.onAccent : colors.textSecondary}
      ios_backgroundColor={colors.surfaceContainerHighest}
    />
  );
}

export default Toggle;
