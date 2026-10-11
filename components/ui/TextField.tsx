import { Ionicons } from "@expo/vector-icons";
import { useState, type Ref } from "react";
import { Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, spacing, touchTarget, typography } from "../../theme/tokens";

export type TextFieldProps = Omit<TextInputProps, "style" | "secureTextEntry"> & {
  label: string;
  helperText?: string;
  error?: string | null;
  variant?: "text" | "password";
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<TextInput>;
};

export function TextField({
  label,
  helperText,
  error,
  variant = "text",
  containerStyle,
  editable = true,
  onFocus,
  onBlur,
  ref,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isPassword = variant === "password";
  const hasError = !!error;

  const borderColor = hasError ? colors.danger : focused ? colors.accent : colors.borderStrong;

  return (
    <View style={[{ gap: spacing.xxs }, containerStyle]}>
      <Text style={[typography.bodySmall, { color: colors.text, fontWeight: "600" }]}>{label}</Text>
      <View
        style={{
          minHeight: touchTarget,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: radius.md,
          borderWidth: focused || hasError ? 2 : 1,
          borderColor,
          backgroundColor: editable ? colors.raised : colors.bg,
          paddingLeft: spacing.sm,
        }}
      >
        <TextInput
          ref={ref}
          {...inputProps}
          editable={editable}
          secureTextEntry={isPassword && hidden}
          autoCapitalize={isPassword ? "none" : inputProps.autoCapitalize}
          autoCorrect={isPassword ? false : inputProps.autoCorrect}
          accessibilityLabel={label}
          accessibilityHint={error ?? helperText}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            typography.body,
            {
              flex: 1,
              color: editable ? colors.text : colors.textMuted,
              paddingVertical: spacing.sm,
              paddingRight: isPassword ? 0 : spacing.sm,
            },
          ]}
        />
        {isPassword && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            style={{ width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={22} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {hasError ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[typography.bodySmall, { color: colors.danger, flex: 1 }]}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

export default TextField;
