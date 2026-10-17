import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import type { MaterialIconName } from "../ui/iconName";
import { VerticalDivider } from "../ui/VerticalDivider";

const NAME_MAX = 40;
/** Gap between the photo and its accent ring. */
const RING_GAP = spacing.xxs + 1;

export type ProfileHeaderProps = {
  name: string;
  email: string;
  photoUri: string | null;
  initials: string;
  verified: boolean;
  google: boolean;
  /** "October 2026" */
  memberSince: string | null;
  workouts: number;
  /** Weeks in a row meeting the weekly goal (same as Home); null without a goal. */
  streak: number | null;
  badges: number | null;
  savingName: boolean;
  onSaveName: (name: string) => Promise<boolean>;
  onVerify: () => void;
  onOpenBadges: () => void;
};

/** Who you are (photo ring, name, badges), an inline name editor, and three numbers. */
export function ProfileHeader(p: ProfileHeaderProps) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.name);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(p.name);
  }, [p.name, editing]);

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== p.name;
  const submit = async () => {
    if (canSave && (await p.onSaveName(trimmed))) setEditing(false);
  };

  return (
    <View style={{ borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.accentSubtle }}>
      <LinearGradient
        colors={[colors.accentSubtle, colors.accentTint, colors.raised]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
          {/* Photo (Google) or initials, in an accent ring */}
          <View style={{ padding: RING_GAP, borderRadius: radius.full, borderWidth: 2, borderColor: colors.accent }}>
            <View style={{ width: size.iconBadge, height: size.iconBadge, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
              {p.photoUri && !photoFailed ? (
                <Image source={{ uri: p.photoUri }} style={{ width: size.iconBadge, height: size.iconBadge }} onError={() => setPhotoFailed(true)} accessibilityIgnoresInvertColors />
              ) : (
                <Text style={[typography.headlineMd, { color: colors.accent }]}>{p.initials || "?"}</Text>
              )}
            </View>
          </View>

          <View style={{ flex: 1, gap: spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[typography.headlineLg, { flexShrink: 1, color: colors.text }]} numberOfLines={1} accessibilityRole="header">
                {p.name || "Add your name"}
              </Text>
              {!editing && (
                <Pressable
                  onPress={() => setEditing(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit display name"
                  hitSlop={spacing.xs}
                  style={({ pressed }) => ({
                    width: size.control,
                    height: size.control,
                    marginVertical: -spacing.sm,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <MaterialIcons name="edit" size={size.iconSm} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
            <Text style={[typography.labelMd, { color: colors.textSecondary }]} numberOfLines={1}>
              {p.email}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs }}>
              {p.verified ? (
                <Badge icon="verified" label="Verified" color={colors.accent} />
              ) : (
                <Pressable onPress={p.onVerify} accessibilityRole="button" accessibilityLabel="Email not verified. Verify now" hitSlop={spacing.sm}>
                  <Badge icon="error-outline" label="Verify email" color={colors.warning} />
                </Pressable>
              )}
              {p.google && <Badge icon="account-circle" label="Google" color={colors.textSecondary} />}
            </View>
            {p.memberSince && <Text style={[typography.labelSm, { color: colors.textMuted }]}>Member since {p.memberSince}</Text>}
          </View>
        </View>

        {/* Inline name editor */}
        {editing && (
          <View style={{ gap: spacing.sm }}>
            <TextField
              label="Display name"
              labelHint="Shown on your profile"
              value={draft}
              onChangeText={setDraft}
              maxLength={NAME_MAX}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button title="Cancel" variant="neutral" onPress={() => setEditing(false)} disabled={p.savingName} style={{ flex: 1 }} />
              <Button title="Save" icon="checkmark" onPress={() => void submit()} loading={p.savingName} disabled={!canSave || p.savingName} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </View>

      {/* The numbers */}
      <View style={{ flexDirection: "row", borderTopWidth: size.divider, borderTopColor: colors.border }}>
        <Stat label="Workouts" value={String(p.workouts)} />
        <VerticalDivider />
        <Stat label="Week streak" value={p.streak == null ? "—" : String(p.streak)} icon={p.streak ? "local-fire-department" : undefined} />
        <VerticalDivider />
        <Stat label="Badges" value={p.badges == null ? "—" : String(p.badges)} icon={p.badges ? "emoji-events" : undefined} onPress={p.onOpenBadges} />
      </View>
    </View>
  );
}

function Badge({ icon, label, color }: { icon: MaterialIconName; label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh }}>
      <MaterialIcons name={icon} size={size.iconXs} color={color} />
      <Text style={[typography.labelSm, { color }]}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, icon, onPress }: { label: string; value: string; icon?: "local-fire-department" | "emoji-events"; onPress?: () => void }) {
  const { colors } = useTheme();
  const body = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Text style={[typography.headlineLg, { color: colors.text }]}>{value}</Text>
        {icon && <MaterialIcons name={icon} size={size.iconSm} color={colors.amber} />}
      </View>
      <Text style={[typography.labelSm, { color: colors.textSecondary, letterSpacing: tracking.overline }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  const style = { flex: 1, alignItems: "center" as const, paddingVertical: spacing.md, gap: spacing.xxs };
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={({ pressed }) => [style, pressed && { backgroundColor: colors.surfaceContainerHigh }]}>
      {body}
    </Pressable>
  ) : (
    <View style={style} accessible accessibilityLabel={`${label}: ${value}`}>
      {body}
    </View>
  );
}
