import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import Animated, { runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../theme/theme";
import { alpha, motion, radius, size, spacing, tracking, typography } from "../../theme/tokens";
import { Button, SpinningIcon, StatusPill } from "../ui";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const APP_ICON = require("../../assets/images/icon.png");

const STAGES = ["Checking your connection", "Waking up the server", "Loading your profile"];
const SLEEP_NOTE_AFTER_S = 10;
/** Within a stage the ring creeps toward the next third but stops short of it. */
const CREEP_MAX = 0.85;
const CREEP_TAU_S = 12;
/** Steps tick off one at a time, at most one per STEP_MS, so a fast start still reads. */
const STEP_MS = 600;
/** Once every step is done: the ring fills, then holds on "ready" before handing over. */
const FILL_MS = 500;
const HOLD_MS = 600;

export type StartupScreenProps = {
  /** Stages completed so far (0..3). */
  stagesDone: number;
  /** Called once all stages are done and the full ring has been shown. */
  onComplete?: () => void;
  /** Show Retry / Open saved data (stuck or failed with saved data available). */
  showActions: boolean;
  hasCachedData: boolean;
  retrying: boolean;
  onRetry: () => void;
  onOpenSaved: () => void;
};

export function StartupScreen({ stagesDone: realDone, onComplete, showActions, hasCachedData, retrying, onRetry, onOpenSaved }: StartupScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const total = STAGES.length;

  // Stages shown as done: follows the real count, one step at a time.
  const [stagesDone, setStagesDone] = useState(0);
  useEffect(() => {
    if (realDone < stagesDone) {
      setStagesDone(realDone);
      return;
    }
    if (realDone === stagesDone) return;
    const id = setTimeout(() => setStagesDone((n) => n + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [realDone, stagesDone]);
  const complete = stagesDone >= total;
  const active = Math.min(stagesDone, total - 1);

  // All done: let the full ring show, then hand over.
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    if (!complete) return;
    const id = setTimeout(() => completeRef.current?.(), FILL_MS + HOLD_MS);
    return () => clearTimeout(id);
  }, [complete]);

  // Seconds spent in the current stage.
  const stageStart = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    stageStart.current = Date.now();
    setElapsed(0);
  }, [active]);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - stageStart.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Ring: real stage boundaries, plus a slow creep that never crosses the next one.
  const r = (size.ring - size.ringStroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);
  useEffect(() => {
    const creep = complete ? 0 : CREEP_MAX * (1 - Math.exp(-elapsed / CREEP_TAU_S));
    const target = Math.min(1, (stagesDone + creep) / total);
    progress.value = withTiming(target, { duration: complete ? FILL_MS : motion.pulseMs });
  }, [stagesDone, complete, elapsed, total, progress]);
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));
  // The number in the ring follows the ring itself.
  const [percent, setPercent] = useState(0);
  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (now, prev) => {
      if (now !== prev) runOnJS(setPercent)(now);
    },
  );

  // Fade the stage text when it changes.
  const textOpacity = useSharedValue(1);
  useEffect(() => {
    textOpacity.value = 0;
    textOpacity.value = withTiming(1, { duration: motion.slideMs });
  }, [active, complete, textOpacity]);
  const fade = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  const waking = active === 1 && !complete;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: spacing.screen }}>
      {/* Top bar */}
      <View style={{ height: size.appBar, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Image source={APP_ICON} style={{ width: size.iconLg, height: size.iconLg, borderRadius: radius.md }} />
          <Text style={[typography.headlineSm, { color: colors.text, textTransform: "uppercase", letterSpacing: tracking.headlineWide }]}>
            Iron Arc
          </Text>
        </View>
        <StatusPill label={complete ? "Connected" : "Connecting"} dotColor={colors.accent} />
      </View>

      {/* Centre */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={complete ? "Your account is ready" : `Starting up, step ${Math.min(stagesDone + 1, total)} of ${total}`}
          style={{ width: size.ring, height: size.ring, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}
        >
          <Svg width={size.ring} height={size.ring} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
            <Circle cx={size.ring / 2} cy={size.ring / 2} r={r} stroke={colors.surfaceContainerHigh} strokeWidth={size.ringStroke} fill="none" />
            <AnimatedCircle
              cx={size.ring / 2}
              cy={size.ring / 2}
              r={r}
              stroke={colors.accent}
              strokeWidth={size.ringStroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={arcProps}
              fill="none"
            />
          </Svg>
          <Text style={[typography.headlineLg, { color: complete ? colors.accent : colors.text }]}>{percent}%</Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary, letterSpacing: tracking.overline }]}>
            {complete ? "READY" : `STEP ${Math.min(stagesDone + 1, total)} OF ${total}`}
          </Text>
        </View>

        <Text accessibilityRole="header" style={[typography.headlineLg, { color: colors.text, textAlign: "center" }]}>
          {complete ? "Your account is ready" : "Getting your account ready"}
        </Text>
        <Animated.View style={[{ alignItems: "center", gap: spacing.xs, minHeight: typography.bodyMd.lineHeight * 3 }, fade]} accessibilityLiveRegion="polite">
          <Text style={[typography.bodyMdMedium, { color: colors.text, textAlign: "center" }]}>
            {complete ? "Opening Iron Arc" : STAGES[active]}
            {waking ? ` · ${elapsed}s` : ""}
          </Text>
          {waking && elapsed >= SLEEP_NOTE_AFTER_S && (
            <Text style={[typography.bodyMd, { color: colors.textSecondary, textAlign: "center", maxWidth: size.textNarrow }]}>
              Free servers sleep when idle. First launch can take up to a minute.
            </Text>
          )}
        </Animated.View>
      </View>

      {/* Stage list */}
      <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.xs }}>
          <Text style={[typography.labelMd, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: tracking.overline }]}>
            Starting up
          </Text>
          <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
            {Math.min(stagesDone, total)} / {total}
          </Text>
        </View>
        <View style={{ gap: spacing.inline }}>
          {STAGES.map((label, i) => {
            const done = i < stagesDone;
            const isActive = i === active && !done;
            return (
              <View
                key={label}
                accessible
                accessibilityLabel={`${label}: ${done ? "done" : isActive ? "in progress" : "queued"}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: isActive ? colors.raised : colors.card,
                  opacity: done || isActive ? 1 : alpha.muted,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flexShrink: 1 }}>
                  {done ? (
                    <MaterialIcons name="check-circle" size={size.iconSm} color={colors.accent} />
                  ) : isActive ? (
                    <SpinningIcon color={colors.warning} iconSize={size.iconSm} />
                  ) : (
                    <MaterialIcons name="radio-button-unchecked" size={size.iconSm} color={colors.borderStrong} />
                  )}
                  <Text style={[isActive ? typography.bodyMdMedium : typography.bodyMd, { color: done || isActive ? colors.text : colors.textSecondary }]}>
                    {label}
                  </Text>
                </View>
                <Text style={[typography.labelSm, { color: isActive ? colors.warning : colors.textSecondary }]}>
                  {done ? "Done" : isActive ? "Active" : "Queued"}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {showActions && (
        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          <Button
            title={retrying ? "Connecting…" : "Retry"}
            leading={retrying ? <SpinningIcon name="refresh" color={colors.onAccent} /> : undefined}
            icon="refresh"
            onPress={onRetry}
            disabled={retrying}
            fullWidth
          />
          {hasCachedData && <Button title="Open saved data" variant="tonal" onPress={onOpenSaved} fullWidth />}
        </View>
      )}
    </View>
  );
}
