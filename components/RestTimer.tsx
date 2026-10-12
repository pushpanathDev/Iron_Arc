import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/theme";

const PRESETS = [30, 60, 90, 120, 180];
const DEFAULT_SECONDS = 90;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface RestTimerProps {
  visible: boolean;
  onClose: () => void;
}

export function RestTimer({ visible, onClose }: RestTimerProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();

  const [duration, setDuration] = useState(DEFAULT_SECONDS);
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = useSharedValue(1);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(
    (secs: number) => {
      clearTimer();
      setDuration(secs);
      setRemaining(secs);
      setRunning(true);
      setFinished(false);
      progress.value = 1;
      progress.value = withTiming(0, {
        duration: secs * 1000,
        easing: Easing.linear,
      });

      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearTimer();
            setRunning(false);
            setFinished(true);
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearTimer, progress],
  );

  const stop = useCallback(() => {
    clearTimer();
    setRunning(false);
    progress.value = withTiming(remaining / duration, { duration: 200 });
  }, [clearTimer, remaining, duration, progress]);

  const reset = useCallback(() => {
    clearTimer();
    setRunning(false);
    setFinished(false);
    setRemaining(duration);
    progress.value = withTiming(1, { duration: 200 });
  }, [clearTimer, duration, progress]);

  useEffect(() => {
    if (!visible) {
      clearTimer();
      setRunning(false);
      setFinished(false);
      setRemaining(duration);
      progress.value = 1;
    }
  }, [visible, clearTimer, duration, progress]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const dismiss = () => {
    clearTimer();
    onClose();
  };

  const RING_SIZE = 220;
  const STROKE = 10;
  const circleCircumference = Math.PI * (RING_SIZE - STROKE);

  const ringStyle = useAnimatedStyle(() => {
    const dashOffset = circleCircumference * (1 - progress.value);
    return {
      transform: [{ rotate: "-90deg" }],
      width: RING_SIZE,
      height: RING_SIZE,
      borderRadius: RING_SIZE / 2,
      borderWidth: STROKE,
      borderColor: colors.accentLight,
      borderTopColor: finished ? colors.success : colors.accent,
      borderRightColor:
        progress.value > 0.75
          ? finished
            ? colors.success
            : colors.accent
          : colors.accentLight,
      borderBottomColor:
        progress.value > 0.5
          ? finished
            ? colors.success
            : colors.accent
          : colors.accentLight,
      borderLeftColor:
        progress.value > 0.25
          ? finished
            ? colors.success
            : colors.accent
          : colors.accentLight,
    };
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={dismiss}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.85)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.lg,
        }}
      >
        {/* Close */}
        <Pressable
          onPress={dismiss}
          style={{
            position: "absolute",
            top: 60,
            right: spacing.lg,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.15)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>

        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "600",
            letterSpacing: 2,
            marginBottom: spacing.xl,
            opacity: 0.7,
          }}
        >
          REST TIMER
        </Text>

        {/* Timer Ring */}
        <Animated.View
          style={[
            ringStyle,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <View
            style={{
              position: "absolute",
              justifyContent: "center",
              alignItems: "center",
              transform: [{ rotate: "90deg" }],
            }}
          >
            <Text
              style={{
                color: finished ? colors.success : "#fff",
                fontSize: 56,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatTime(remaining)}
            </Text>
            {finished && (
              <Text
                style={{
                  color: colors.success,
                  fontSize: 16,
                  fontWeight: "700",
                  marginTop: spacing.xs,
                }}
              >
                TIME'S UP!
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Progress Bar */}
        <View
          style={{
            width: "80%",
            height: 4,
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 2,
            marginTop: spacing.xl,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={[
              progressStyle,
              {
                height: "100%",
                backgroundColor: finished ? colors.success : colors.accent,
                borderRadius: 2,
              },
            ]}
          />
        </View>

        {/* Controls */}
        <View
          style={{
            flexDirection: "row",
            marginTop: spacing.xl,
            gap: spacing.md,
          }}
        >
          {running ? (
            <>
              <Pressable
                onPress={stop}
                style={{
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.xl,
                  borderRadius: radius.xl,
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                  Pause
                </Text>
              </Pressable>
              <Pressable
                onPress={reset}
                style={{
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.xl,
                  borderRadius: radius.xl,
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontWeight: "600",
                    fontSize: 16,
                  }}
                >
                  Reset
                </Text>
              </Pressable>
            </>
          ) : finished ? (
            <>
              <Pressable
                onPress={dismiss}
                style={{
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.xl,
                  borderRadius: radius.xl,
                  backgroundColor: colors.success,
                }}
              >
                <Text style={{ color: colors.onAccent, fontWeight: "700", fontSize: 16 }}>
                  Done
                </Text>
              </Pressable>
              <Pressable
                onPress={() => start(duration)}
                style={{
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.xl,
                  borderRadius: radius.xl,
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                  Restart
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => start(remaining > 0 ? remaining : duration)}
              style={{
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xxl,
                borderRadius: radius.xl,
                backgroundColor: colors.accent,
              }}
            >
              <Text style={{ color: colors.onAccent, fontWeight: "700", fontSize: 18 }}>
                {remaining < duration ? "Resume" : "Start"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Duration Presets */}
        {!running && !finished && (
          <View
            style={{
              flexDirection: "row",
              marginTop: spacing.xl,
              gap: spacing.sm,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {PRESETS.map((secs) => {
              const active = duration === secs && remaining === secs;
              return (
                <Pressable
                  key={secs}
                  onPress={() => {
                    setDuration(secs);
                    setRemaining(secs);
                    progress.value = withTiming(1, { duration: 200 });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: active
                      ? colors.accent
                      : "rgba(255,255,255,0.1)",
                    borderWidth: 1,
                    borderColor: active
                      ? colors.accent
                      : "rgba(255,255,255,0.15)",
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.onAccent : "rgba(255,255,255,0.7)",
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    {formatTime(secs)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}
