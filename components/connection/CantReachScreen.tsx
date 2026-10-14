import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatRelativeTime } from "../../context/ConnectionContext";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { Button, SpinningIcon } from "../ui";

export type CantReachScreenProps = {
  /** No network at all (vs. network up but server not answering). */
  offline: boolean;
  retrying: boolean;
  onRetry: () => void;
  lastSyncedAt: number | null;
};

/** Full-screen state when we can't reach the server and have nothing saved to show. */
export function CantReachScreen({ offline, retrying, onRetry, lastSyncedAt }: CantReachScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [, tick] = useState(0);

  // Keep "Last synced … ago" current.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: spacing.screen }}>
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ width: size.statusDot, height: size.statusDot, borderRadius: radius.full, backgroundColor: colors.warning }} />
        <Text style={[typography.labelSm, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>
          Offline
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
        <View
          style={{
            width: size.iconBadge,
            height: size.iconBadge,
            borderRadius: radius.full,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.md,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <MaterialIcons name="cloud-off" size={size.logoMark} color={colors.textSecondary} />
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: size.goalDot,
              height: size.goalDot,
              borderRadius: radius.full,
              backgroundColor: colors.danger,
              borderWidth: spacing.xxs,
              borderColor: colors.bg,
            }}
          />
        </View>
        <Text accessibilityRole="header" style={[typography.headlineLg, { color: colors.text, textAlign: "center" }]}>
          Can&apos;t reach the server
        </Text>
        <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center", maxWidth: size.textNarrow }]}>
          {offline ? "Check your connection and try again." : "Our server isn't responding. Try again in a moment."}
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.card,
            maxWidth: size.dialogMax,
            marginVertical: spacing.md,
          }}
        >
          <MaterialIcons name="verified" size={size.iconSm} color={colors.accent} />
          <Text style={[typography.labelSm, { color: colors.textSecondary, flex: 1 }]}>
            Your workouts are saved on the server. Nothing has been lost. We&apos;ll keep trying and continue automatically once
            we&apos;re connected.
          </Text>
        </View>

        <View style={{ alignSelf: "stretch", maxWidth: size.dialogMax, width: "100%", alignItems: "center" }}>
          <Button
            title={retrying ? "Connecting…" : "Try again"}
            leading={retrying ? <SpinningIcon name="refresh" color={colors.onAccent} /> : undefined}
            icon="refresh"
            haptic
            onPress={onRetry}
            disabled={retrying}
            fullWidth
          />
        </View>
      </View>

      {lastSyncedAt != null && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            padding: spacing.md,
            marginBottom: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.card,
          }}
        >
          <View style={{ width: size.statusDot, height: size.statusDot, borderRadius: radius.full, backgroundColor: colors.warning }} />
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>Last synced {formatRelativeTime(lastSyncedAt)}</Text>
        </View>
      )}
    </View>
  );
}

export default CantReachScreen;
