import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Button } from "../ui/Button";
import type { PermissionState } from "../../notifications/notificationService";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";
import type { MaterialIconName } from "../ui/iconName";

/** "Turn on notifications" (not asked) / "Notifications are off" (blocked) / not supported here. */
export function PermissionBanner({ supported, permission, onAllow }: { supported: boolean; permission: PermissionState; onAllow: () => void }) {
  const { colors } = useTheme();
  const notAsked = permission.status === "undetermined" || permission.canAskAgain;
  const s = !supported
    ? { icon: "info-outline" as MaterialIconName, tint: colors.textSecondary, title: "Reminders need the installed app", body: "They don't run in Expo Go or on a simulator.", action: null }
    : notAsked
      ? { icon: "notifications" as MaterialIconName, tint: colors.accent, title: "Turn on notifications", body: "Get workout reminders and rest alerts.", action: "Allow" }
      : { icon: "notifications-off" as MaterialIconName, tint: colors.warning, title: "Notifications are off for Iron Arc", body: "Turn them on in your phone's settings to get reminders.", action: "Open settings" };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.raised, borderWidth: 1, borderColor: s.tint === colors.warning ? colors.warning : colors.accentSubtle }}>
      <View style={{ width: size.rowIcon, height: size.rowIcon, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
        <MaterialIcons name={s.icon} size={size.iconLg} color={s.tint} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={[typography.bodyMdMedium, { color: colors.text }]}>{s.title}</Text>
        <Text style={[typography.labelSm, { color: colors.textSecondary }]}>{s.body}</Text>
      </View>
      {s.action ? <Button title={s.action} onPress={onAllow} variant={notAsked ? "primary" : "tonal"} /> : null}
    </View>
  );
}
