import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        height: size.control,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radius.lg,
        paddingLeft: spacing.md,
        backgroundColor: focused ? colors.surfaceContainerHigh : colors.raised,
      }}
    >
      <MaterialIcons name="search" size={size.icon} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search exercises"
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search exercises"
        style={[typography.bodyMd, { flex: 1, color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: 0, height: size.control }]}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={{ width: size.control, height: size.control, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialIcons name="close" size={size.icon} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}
