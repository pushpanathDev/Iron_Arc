import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../../theme/theme";
import { alpha, motion, radius, size, spacing, typography, withAlpha } from "../../theme/tokens";
import { FadingMessage } from "./FadingMessage";
import { PressableScale } from "./PressableScale";

export type TextFieldProps = Omit<TextInputProps, "style" | "secureTextEntry"> & {
  label: string;
  /** Short note on the right of the label, e.g. "Required". */
  labelHint?: string;
  helperText?: string;
  error?: string | null;
  variant?: "text" | "password";
  /** Keep one line under the field for errors so showing one never shifts the layout. */
  reserveMessageSpace?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<TextInput>;
};

/** Filled text field: no border, background lifts on focus. */
export function TextField({
  label,
  labelHint,
  helperText,
  error,
  variant = "text",
  reserveMessageSpace = false,
  containerStyle,
  editable = true,
  onFocus,
  onBlur,
  onSelectionChange,
  ref,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);
  const isPassword = variant === "password";
  const hasError = !!error;
  const message = error || helperText;

  const inputRef = useRef<TextInput | null>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const setRefs = useCallback(
    (node: TextInput | null) => {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: TextInput | null }).current = node;
    },
    [ref],
  );

  const toggleVisibility = () => {
    const saved = selection.current;
    setHidden((h) => !h);
    // Switching secure entry re-creates the native text on Android and moves the cursor; put it back.
    if (saved) requestAnimationFrame(() => inputRef.current?.setSelection(saved.start, saved.end));
  };

  const focus = useSharedValue(0);
  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(focus.value, [0, 1], [colors.card, colors.raised]),
  }));
  useEffect(() => {
    if (!editable) focus.value = 0;
  }, [editable, focus]);

  return (
    <View style={[{ gap: spacing.sm }, containerStyle]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={[typography.labelMd, { color: colors.textSecondary }]}>{label}</Text>
        {labelHint && (
          <Text
            style={[typography.labelSm, { color: withAlpha(colors.textSecondary, alpha.muted) }]}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {labelHint}
          </Text>
        )}
      </View>
      <Animated.View
        style={[
          {
            minHeight: size.control,
            borderRadius: radius.lg,
            justifyContent: "center",
            borderWidth: hasError ? size.divider : 0,
            borderColor: colors.danger,
          },
          fill,
        ]}
      >
        <TextInput
          ref={setRefs}
          {...inputProps}
          editable={editable}
          secureTextEntry={isPassword && hidden}
          autoCapitalize={isPassword ? "none" : inputProps.autoCapitalize}
          autoCorrect={isPassword ? false : inputProps.autoCorrect}
          accessibilityLabel={labelHint ? `${label}, ${labelHint.toLowerCase()}` : label}
          accessibilityHint={error ?? helperText}
          placeholderTextColor={withAlpha(colors.textSecondary, alpha.placeholder)}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          onSelectionChange={(e) => {
            selection.current = e.nativeEvent.selection;
            onSelectionChange?.(e);
          }}
          onFocus={(e) => {
            focus.value = withTiming(1, { duration: motion.focusMs });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, { duration: motion.focusMs });
            onBlur?.(e);
          }}
          style={[
            typography.bodyMd,
            {
              minHeight: size.control,
              color: editable ? colors.text : colors.textMuted,
              paddingLeft: spacing.lg,
              paddingRight: isPassword ? size.control : spacing.lg,
              paddingVertical: 0,
            },
          ]}
        />
        {isPassword && (
          <PressableScale
            onPress={toggleVisibility}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: size.control,
              height: size.control,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {({ pressed }) => (
              <MaterialIcons
                name={hidden ? "visibility" : "visibility-off"}
                size={size.icon}
                color={pressed ? colors.text : colors.textSecondary}
              />
            )}
          </PressableScale>
        )}
      </Animated.View>
      {reserveMessageSpace ? (
        <FadingMessage message={message} color={hasError ? colors.danger : colors.textSecondary} live={hasError} />
      ) : (
        !!message && (
          <Text
            accessibilityLiveRegion={hasError ? "polite" : "none"}
            style={[typography.labelSm, { color: hasError ? colors.danger : colors.textSecondary }]}
          >
            {message}
          </Text>
        )
      )}
    </View>
  );
}

export default TextField;
