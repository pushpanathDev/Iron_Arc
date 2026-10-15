import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, touchTarget, typography } from "../../theme/tokens";
import { PressableScale } from "./PressableScale";

export type AvatarProps = { photoUri: string | null; initials: string; onPress: () => void };

/** Profile photo (or initials) in a 48px touch target; opens the profile. */
export function Avatar({ photoUri, initials, onPress }: AvatarProps) {
  const { colors } = useTheme();
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!photoUri && !photoFailed;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      style={{ width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: size.avatar,
          height: size.avatar,
          borderRadius: radius.full,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceContainerHigh,
          borderWidth: size.divider,
          borderColor: colors.border,
        }}
      >
        {showPhoto ? (
          <Image source={{ uri: photoUri }} onError={() => setPhotoFailed(true)} style={{ width: size.avatar, height: size.avatar }} />
        ) : initials ? (
          <Text style={[typography.labelLg, { color: colors.accent }]} maxFontSizeMultiplier={1.2}>
            {initials}
          </Text>
        ) : (
          <Ionicons name="person" size={size.icon} color={colors.accent} />
        )}
      </View>
    </PressableScale>
  );
}
