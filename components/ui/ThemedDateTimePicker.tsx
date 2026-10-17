import DateTimePicker, { type AndroidNativeProps } from "@react-native-community/datetimepicker";
import { useTheme } from "../../theme/theme";

/**
 * The native date/time dialog with OK and Cancel in the theme's accent.
 * Android bakes the rest of its colours in at build time (app.json), so the
 * selected day and clock hand are a neutral grey that suits every theme.
 */
export function ThemedDateTimePicker(props: AndroidNativeProps) {
  const { colors } = useTheme();
  return <DateTimePicker positiveButton={{ textColor: colors.accent }} negativeButton={{ textColor: colors.textSecondary }} {...props} />;
}
