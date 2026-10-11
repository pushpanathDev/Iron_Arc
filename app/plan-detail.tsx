/**
 * Plan Detail Screen
 *
 * Two tabs: Schedule (day cards) and Chat (AI trainer chat).
 * Navigate here with: router.navigate('/plan-detail?id=<planId>')
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "../context/ToastContext";
import {
  usePlan,
  usePlanChat,
  useRecalibratePlan,
  useRenamePlan,
  useSubstituteExercise,
} from "../hooks/usePlan";
import { ChatMessage } from "../services/api";
import { useTheme } from "../theme/theme";

/* ─────────────────────────────────────────────────────────────
   Plan Data Parsing
───────────────────────────────────────────────────────────── */
interface PlanExercise {
  id?: string;
  exerciseId?: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  progressionNote?: string;
  notes?: string;
  substitutes?: string[];
  substitutedFrom?: string;
}

interface PlanDay {
  day?: string;
  name?: string;
  sessionType?: "training" | "rest";
  targetMuscles?: string[];
  estimatedDurationMinutes?: number;
  recoveryNote?: string;
  exercises?: PlanExercise[];
}

function getPlanDays(planData: any): PlanDay[] {
  if (Array.isArray(planData?.weeks) && planData.weeks.length > 0) {
    return planData.weeks[0].days ?? [];
  }
  if (Array.isArray(planData?.days)) return planData.days;
  return [];
}

function getPlanDataForDisplay(planData: any): any {
  if (!planData) return planData;
  // Strip internal storage keys before passing to UI or prompts
  const { _chatHistory: _omit, ...clean } = planData;
  return clean;
}

/* ─────────────────────────────────────────────────────────────
   Muscle group accent colour
───────────────────────────────────────────────────────────── */
function getMuscleAccent(muscles: string[] = [], colors: any): string {
  const all = muscles.join(" ").toLowerCase();
  if (all.includes("chest") || all.includes("push") || all.includes("tricep")) return colors.categoryPush;
  if (all.includes("back") || all.includes("pull") || all.includes("lat") || all.includes("bicep")) return colors.categoryPull;
  if (all.includes("leg") || all.includes("quad") || all.includes("hamstring") || all.includes("glute") || all.includes("calf")) return colors.categoryLegs;
  if (all.includes("shoulder") || all.includes("delt")) return colors.categoryShoulders;
  if (all.includes("core") || all.includes("ab")) return colors.categoryCore;
  if (all.includes("full") || all.includes("compound")) return colors.categoryPush;
  return colors.categoryNeutral;
}

/* ─────────────────────────────────────────────────────────────
   Exercise Card
───────────────────────────────────────────────────────────── */
function ExerciseCard({
  exercise,
  index,
  accent,
  onSubstitute,
  colors,
  spacing,
  radius,
  typography,
}: {
  exercise: PlanExercise;
  index: number;
  accent: string;
  onSubstitute: (id: string, name: string) => void;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
}) {
  const exId = exercise.exerciseId ?? exercise.id ?? exercise.name;
  const wasSubstituted = Boolean(exercise.substitutedFrom);
  const note = exercise.progressionNote ?? exercise.notes;
  const totalVolume = typeof exercise.sets === "number" ? exercise.sets : 0;

  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderRadius: radius.lg,
        marginTop: spacing.sm,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: wasSubstituted ? accent + "40" : colors.cardBorder,
      }}
    >
      {/* Left accent bar */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 3, backgroundColor: accent, borderRadius: 2 }} />
        <View style={{ flex: 1, padding: spacing.sm + 2 }}>
          {/* Top row: name + swap button */}
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: radius.md,
                backgroundColor: accent + "18",
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm,
                marginTop: 1,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "800", color: accent }}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodyMedium, color: colors.textPrimary, fontWeight: "700", lineHeight: 20 }}>
                {exercise.name}
              </Text>
              {wasSubstituted && (
                <Text style={{ ...typography.caption, color: accent, fontSize: 10, fontWeight: "600", marginTop: 1 }}>
                  ↔ swapped from {exercise.substitutedFrom}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => onSubstitute(exId, exercise.name)}
              hitSlop={8}
              style={{
                paddingVertical: 4,
                paddingHorizontal: spacing.sm,
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.md,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <Ionicons name="swap-horizontal-outline" size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>Swap</Text>
            </Pressable>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: spacing.sm, flexWrap: "wrap" }}>
            {/* Sets × Reps badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: accent + "18",
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: accent }}>
                {exercise.sets}
              </Text>
              <Text style={{ fontSize: 11, color: accent + "99", fontWeight: "600" }}> × </Text>
              <Text style={{ fontSize: 13, fontWeight: "800", color: accent }}>
                {exercise.reps}
              </Text>
            </View>

            {/* Rest time */}
            {exercise.restSeconds ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <Text style={{ ...typography.caption, color: colors.textMuted, fontSize: 12 }}>
                  {exercise.restSeconds >= 60
                    ? `${Math.floor(exercise.restSeconds / 60)}m${exercise.restSeconds % 60 > 0 ? ` ${exercise.restSeconds % 60}s` : ""} rest`
                    : `${exercise.restSeconds}s rest`}
                </Text>
              </View>
            ) : null}

            {/* Total sets indicator */}
            {totalVolume > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                {Array.from({ length: Math.min(totalVolume, 6) }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: i < totalVolume ? accent : colors.cardBorder,
                      opacity: i < totalVolume ? 0.7 : 0.3,
                    }}
                  />
                ))}
                {totalVolume > 6 && (
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>+{totalVolume - 6}</Text>
                )}
              </View>
            )}
          </View>

          {/* Progression note */}
          {note && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: spacing.xs }}>
              <Ionicons name="trending-up-outline" size={12} color={colors.success} style={{ marginTop: 2 }} />
              <Text style={{ ...typography.caption, color: colors.success, flex: 1, lineHeight: 17, fontSize: 12 }}>
                {note}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Day Card
───────────────────────────────────────────────────────────── */
function DayCard({
  day,
  index,
  onSubstitute,
  colors,
  spacing,
  radius,
  shadows,
  typography,
}: {
  day: PlanDay;
  index: number;
  onSubstitute: (id: string, name: string) => void;
  colors: any;
  spacing: any;
  radius: any;
  shadows: any;
  typography: any;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const isRest = day.sessionType === "rest";
  const dayLabel = day.name ?? day.day ?? `Day ${index + 1}`;
  const exercises = day.exercises ?? [];
  const accent = getMuscleAccent(day.targetMuscles, colors);
  const totalSets = exercises.reduce((s, e) => s + (typeof e.sets === "number" ? e.sets : 0), 0);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 60).duration(350)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: isRest ? colors.cardBorder : accent + "30",
        overflow: "hidden",
        ...shadows.sm,
      }}
    >
      {/* Coloured top bar for training days */}
      {!isRest && (
        <View style={{ height: 3, backgroundColor: accent, borderRadius: 1 }} />
      )}

      <Pressable
        onPress={() => !isRest && setExpanded((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", padding: spacing.md, paddingTop: isRest ? spacing.md : spacing.sm + 2 }}
        activeOpacity={isRest ? 1 : 0.7}
      >
        {/* Day badge */}
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: radius.lg,
            backgroundColor: isRest ? colors.surfaceElevated : accent + "18",
            justifyContent: "center",
            alignItems: "center",
            marginRight: spacing.md,
            borderWidth: 1,
            borderColor: isRest ? colors.cardBorder : accent + "30",
          }}
        >
          {isRest ? (
            <Ionicons name="moon-outline" size={18} color={colors.textMuted} />
          ) : (
            <>
              <Text style={{ fontSize: 15, fontWeight: "800", color: accent, lineHeight: 17 }}>
                {index + 1}
              </Text>
              <Text style={{ fontSize: 9, fontWeight: "600", color: accent + "99", lineHeight: 11 }}>
                DAY
              </Text>
            </>
          )}
        </View>

        {/* Label + muscles */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.textPrimary,
              textTransform: "capitalize",
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {dayLabel}
          </Text>
          {isRest ? (
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {day.recoveryNote ?? "Rest & active recovery"}
            </Text>
          ) : day.targetMuscles && day.targetMuscles.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
              {day.targetMuscles.slice(0, 3).map((m) => (
                <View
                  key={m}
                  style={{
                    backgroundColor: accent + "18",
                    borderRadius: radius.full,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: accent, textTransform: "capitalize" }}>
                    {m}
                  </Text>
                </View>
              ))}
              {(day.targetMuscles.length ?? 0) > 3 && (
                <Text style={{ ...typography.caption, color: colors.textMuted, alignSelf: "center" }}>
                  +{day.targetMuscles.length - 3}
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* Right side metadata */}
        {!isRest && (
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            {day.estimatedDurationMinutes ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <Text style={{ ...typography.caption, color: colors.textMuted, fontSize: 12 }}>
                  {day.estimatedDurationMinutes}m
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: accent }}>{exercises.length}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted, fontSize: 11 }}>exercises</Text>
            </View>
            {totalSets > 0 && (
              <Text style={{ ...typography.caption, color: colors.textMuted, fontSize: 11 }}>
                {totalSets} sets
              </Text>
            )}
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textMuted}
              style={{ marginTop: 2 }}
            />
          </View>
        )}
      </Pressable>

      {/* Exercise cards */}
      {expanded && !isRest && exercises.length > 0 && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 0 }}>
          {exercises.map((ex, i) => (
            <ExerciseCard
              key={ex.exerciseId ?? ex.id ?? i}
              exercise={ex}
              index={i}
              accent={accent}
              onSubstitute={onSubstitute}
              colors={colors}
              spacing={spacing}
              radius={radius}
              typography={typography}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Chat Message Bubble
───────────────────────────────────────────────────────────── */
function ChatBubble({
  msg,
  planUpdatedAt,
  colors,
  spacing,
  radius,
  typography,
}: {
  msg: ChatMessage & { planUpdated?: boolean };
  planUpdatedAt?: string;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
}) {
  const isUser = msg.role === "user";

  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <View
      style={{
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      {!isUser && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 6 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: radius.full,
              backgroundColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="barbell" size={12} color={colors.textOnAccent} />
          </View>
          <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: "600" }}>
            AI Trainer
          </Text>
        </View>
      )}

      <View
        style={{
          maxWidth: "80%",
          backgroundColor: isUser ? colors.accent : colors.surface,
          borderRadius: radius.xl,
          borderBottomRightRadius: isUser ? 4 : radius.xl,
          borderBottomLeftRadius: isUser ? radius.xl : 4,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          borderWidth: isUser ? 0 : 1,
          borderColor: colors.cardBorder,
        }}
      >
        <Text
          style={{
            ...typography.body,
            color: isUser ? colors.textOnAccent : colors.textPrimary,
            lineHeight: 21,
          }}
        >
          {msg.content}
        </Text>

        {msg.planUpdated && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 6,
              gap: 4,
              borderTopWidth: 1,
              borderTopColor: colors.divider,
              paddingTop: 6,
            }}
          >
            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
            <Text style={{ ...typography.caption, color: colors.success, fontWeight: "700" }}>
              Plan updated
            </Text>
          </View>
        )}
      </View>

      {time ? (
        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 3, fontSize: 11 }}>
          {time}
        </Text>
      ) : null}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Thinking indicator
───────────────────────────────────────────────────────────── */
function ThinkingBubble({ colors, spacing, radius, typography }: any) {
  return (
    <View style={{ alignItems: "flex-start", marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 6 }}>
        <View style={{ width: 24, height: 24, borderRadius: radius.full, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="barbell" size={12} color={colors.textOnAccent} />
        </View>
        <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: "600" }}>AI Trainer</Text>
      </View>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderBottomLeftRadius: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: colors.cardBorder, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={{ ...typography.body, color: colors.textSecondary }}>Thinking…</Text>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────── */
type Tab = "schedule" | "chat";

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const { data: plan, isLoading } = usePlan(id);
  const recalibrate = useRecalibratePlan();
  const renameMutation = useRenamePlan();
  const substituteMutation = useSubstituteExercise();
  const chatMutation = usePlanChat(id);

  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [showRecalibrateConfirm, setShowRecalibrateConfirm] = useState(false);
  const [substituteTarget, setSubstituteTarget] = useState<{ id: string; name: string } | null>(null);
  const [substituteReason, setSubstituteReason] = useState("");
  const [chatInput, setChatInput] = useState("");
  // Local chat messages so the UI updates optimistically
  const [localMessages, setLocalMessages] = useState<(ChatMessage & { planUpdated?: boolean })[]>([]);
  const chatListRef = useRef<FlatList>(null);

  // Sync chat history from server into local state (only on load).
  // History can be a top-level field (if schema was migrated) or
  // embedded in planData._chatHistory (no-migration fallback).
  useEffect(() => {
    if (localMessages.length > 0) return;
    const fromTopLevel = Array.isArray(plan?.chatHistory) ? plan.chatHistory : null;
    const fromPlanData = Array.isArray((plan?.planData as any)?._chatHistory)
      ? (plan?.planData as any)._chatHistory
      : null;
    const history = fromTopLevel ?? fromPlanData ?? [];
    if (history.length > 0) setLocalMessages(history as any);
  }, [plan?.chatHistory, plan?.planData]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  if (isLoading || !plan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const planData = getPlanDataForDisplay(plan.planData as any);
  const days = getPlanDays(planData);

  const handleRecalibrate = () => {
    recalibrate.mutate(plan.id, {
      onSuccess: () => {
        showToast({ message: "Plan recalibrated!", type: "success" });
        setShowRecalibrateConfirm(false);
      },
      onError: () => {
        showToast({ message: "Failed to recalibrate. Please try again.", type: "error" });
        setShowRecalibrateConfirm(false);
      },
    });
  };

  const handleRename = () => {
    if (!newName.trim()) return;
    renameMutation.mutate(
      { planId: plan.id, name: newName.trim() },
      {
        onSuccess: () => {
          showToast({ message: "Plan renamed.", type: "success" });
          setShowRenameModal(false);
        },
        onError: () => showToast({ message: "Failed to rename.", type: "error" }),
      },
    );
  };

  const handleSubstitute = () => {
    if (!substituteTarget) return;
    substituteMutation.mutate(
      { planId: plan.id, exerciseId: substituteTarget.id, reason: substituteReason || undefined },
      {
        onSuccess: () => {
          showToast({ message: "Exercise substituted!", type: "success" });
          setSubstituteTarget(null);
        },
        onError: () => showToast({ message: "Failed to substitute.", type: "error" }),
      },
    );
  };

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text || chatMutation.isPending) return;

    setChatInput("");

    const userMsg: ChatMessage & { planUpdated?: boolean } = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    chatMutation.mutate(text, {
      onSuccess: (response) => {
        const aiMsg: ChatMessage & { planUpdated?: boolean } = {
          role: "assistant",
          content: response.message,
          timestamp: new Date().toISOString(),
          planUpdated: response.planUpdated,
        };
        setLocalMessages((prev) => [...prev, aiMsg]);
        scrollToBottom();

        if (response.planUpdated) {
          showToast({ message: "Your plan was updated!", type: "success" });
        }
      },
      onError: () => {
        setLocalMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I ran into an error. Please try again.",
            timestamp: new Date().toISOString(),
          },
        ]);
        scrollToBottom();
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ── */}
      <LinearGradient
        // Same background as the tab screens, so the status bar area matches the app.
        colors={[colors.background, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: spacing.md, padding: spacing.xs }}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            {plan.isActive && (
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 2 }}>
                ACTIVE PLAN
              </Text>
            )}
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }} numberOfLines={1}>
              {plan.name}
            </Text>
          </View>
          <Pressable
            onPress={() => { setNewName(plan.name); setShowRenameModal(true); }}
            style={{ backgroundColor: colors.surfaceElevated, borderRadius: radius.full, padding: spacing.sm, marginLeft: spacing.sm }}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => setShowRecalibrateConfirm(true)}
            style={{ backgroundColor: colors.surfaceElevated, borderRadius: radius.full, padding: spacing.sm, marginLeft: spacing.sm }}
          >
            {recalibrate.isPending ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} />
            )}
          </Pressable>
        </View>

        {/* ── Tab Bar ── */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.xl,
            padding: 3,
          }}
        >
          {(["schedule", "chat"] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: activeTab === tab ? colors.surface : "transparent",
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <Ionicons
                name={tab === "schedule" ? "calendar-outline" : "chatbubble-ellipses-outline"}
                size={15}
                color={activeTab === tab ? colors.accent : colors.textSecondary}
              />
              <Text
                style={{
                  fontWeight: "700",
                  fontSize: 14,
                  color: activeTab === tab ? colors.accent : colors.textSecondary,
                  textTransform: "capitalize",
                }}
              >
                {tab === "schedule" ? "Schedule" : "AI Chat"}
              </Text>
              {tab === "chat" && localMessages.length > 0 && (
                <View
                  style={{
                    backgroundColor: activeTab === "chat" ? colors.accent : colors.textMuted,
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: colors.textOnAccent, fontSize: 10, fontWeight: "700" }}>
                    {localMessages.length}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* ── Schedule Tab ── */}
      {activeTab === "schedule" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 60 }}
        >
          {planData?.planExplanation && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={{
                backgroundColor: colors.accentDim,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: `${colors.accent}30`,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: spacing.sm,
              }}
            >
              <Ionicons name="information-circle" size={20} color={colors.accent} style={{ marginTop: 2 }} />
              <Text style={{ ...typography.body, color: colors.accent, flex: 1, lineHeight: 20 }}>
                {planData.planExplanation}
              </Text>
            </Animated.View>
          )}

          {/* Plan overview stats */}
          <Animated.View
            entering={FadeInDown.delay(50).duration(300)}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              overflow: "hidden",
              ...shadows.sm,
            }}
          >
            {/* Top gradient strip */}
            <View style={{ height: 3, backgroundColor: colors.accent }} />
            <View style={{ padding: spacing.md, flexDirection: "row" }}>
              {[
                {
                  label: "WEEK",
                  value: `${plan.weekNumber}${Array.isArray(planData?.weeks) ? `/${planData.weeks.length}` : ""}`,
                  icon: "calendar-outline" as const,
                  color: colors.categoryPush,
                },
                {
                  label: "SESSIONS",
                  value: `${days.filter((d) => d.sessionType !== "rest").length}×`,
                  icon: "barbell-outline" as const,
                  color: colors.categoryPull,
                },
                {
                  label: "TOTAL SETS",
                  value: String(days.flatMap((d) => d.exercises ?? []).reduce((s, e) => s + (typeof e.sets === "number" ? e.sets : 0), 0)),
                  icon: "layers-outline" as const,
                  color: colors.categoryLegs,
                },
                {
                  label: "EXERCISES",
                  value: String(days.flatMap((d) => d.exercises ?? []).length),
                  icon: "fitness-outline" as const,
                  color: colors.categoryCore,
                },
              ].map((stat, i) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    borderLeftWidth: i > 0 ? 1 : 0,
                    borderLeftColor: colors.cardBorder,
                    paddingVertical: spacing.sm,
                  }}
                >
                  <Ionicons name={stat.icon} size={16} color={stat.color} />
                  <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginTop: 4 }}>
                    {stat.value}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: "600", color: colors.textMuted, letterSpacing: 0.5 }}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {days.map((day, i) => (
            <DayCard
              key={i}
              day={day}
              index={i}
              onSubstitute={(xId, xName) => { setSubstituteTarget({ id: xId, name: xName }); setSubstituteReason(""); }}
              colors={colors}
              spacing={spacing}
              radius={radius}
              shadows={shadows}
              typography={typography}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Chat Tab ── */}
      {activeTab === "chat" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {/* Messages */}
          <FlatList
            ref={chatListRef}
            data={localMessages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
              flexGrow: 1,
            }}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl * 2 }}>
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: radius.full,
                    backgroundColor: colors.accentDim,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: spacing.lg,
                    borderWidth: 2,
                    borderColor: `${colors.accent}30`,
                  }}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.accent} />
                </View>
                <Text style={{ ...typography.h3, color: colors.textPrimary, textAlign: "center", marginBottom: spacing.sm }}>
                  Chat with your AI trainer
                </Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22 }}>
                  Ask anything about your plan, request changes, or get coaching tips. Your plan updates live.
                </Text>
                <View style={{ marginTop: spacing.lg, gap: spacing.sm, width: "100%" }}>
                  {[
                    "Add a finisher to Monday's session",
                    "Remove deadlifts, I have back pain",
                    "Make Tuesday harder — I'm progressing fast",
                    "What's the goal of this push day?",
                  ].map((hint) => (
                    <Pressable
                      key={hint}
                      onPress={() => setChatInput(hint)}
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: radius.lg,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderWidth: 1,
                        borderColor: `${colors.accent}30`,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                      }}
                    >
                      <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.accent} />
                      <Text style={{ ...typography.body, color: colors.textPrimary, flex: 1 }}>{hint}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <ChatBubble
                msg={item}
                colors={colors}
                spacing={spacing}
                radius={radius}
                typography={typography}
              />
            )}
            ListFooterComponent={chatMutation.isPending ? (
              <ThinkingBubble colors={colors} spacing={spacing} radius={radius} typography={typography} />
            ) : null}
            onContentSizeChange={scrollToBottom}
          />

          {/* Chat Input */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              paddingBottom: insets.bottom + spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.cardBorder,
              backgroundColor: colors.background,
              gap: spacing.sm,
            }}
          >
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Ask your trainer anything…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                color: colors.textPrimary,
                ...typography.body,
                borderWidth: 1,
                borderColor: chatInput.length > 0 ? `${colors.accent}60` : colors.cardBorder,
                maxHeight: 120,
              }}
              returnKeyType="default"
              blurOnSubmit={false}
            />
            <Pressable
              onPress={handleSendChat}
              disabled={!chatInput.trim() || chatMutation.isPending}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.full,
                backgroundColor: chatInput.trim() && !chatMutation.isPending ? colors.accent : colors.surfaceElevated,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="send"
                size={18}
                color={chatInput.trim() && !chatMutation.isPending ? colors.textOnAccent : colors.textMuted}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── Rename Modal ── */}
      <Modal visible={showRenameModal} transparent animationType="fade" onRequestClose={() => setShowRenameModal(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: spacing.lg }}
          onPress={() => setShowRenameModal(false)}
        >
          <Pressable
            style={{ backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xl, width: "100%", maxWidth: 400, ...shadows.lg }}
            onPress={() => {}}
          >
            <Text style={{ ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md }}>
              Rename Plan
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Plan name"
              placeholderTextColor={colors.textMuted}
              autoFocus
              maxLength={60}
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.lg,
                padding: spacing.md,
                color: colors.textPrimary,
                ...typography.body,
                marginBottom: spacing.lg,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowRenameModal(false)}
                style={{ flex: 1, paddingVertical: spacing.md, backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.cardBorder }}
              >
                <Text style={{ ...typography.bodyMedium, color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRename}
                disabled={renameMutation.isPending || !newName.trim()}
                style={{ flex: 1, paddingVertical: spacing.md, backgroundColor: colors.accent, borderRadius: radius.lg, alignItems: "center", opacity: !newName.trim() ? 0.5 : 1 }}
              >
                {renameMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <Text style={{ color: colors.textOnAccent, fontWeight: "700" }}>Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Recalibrate Confirm Modal ── */}
      <Modal visible={showRecalibrateConfirm} transparent animationType="fade" onRequestClose={() => setShowRecalibrateConfirm(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: spacing.lg }}
          onPress={() => setShowRecalibrateConfirm(false)}
        >
          <Pressable
            style={{ backgroundColor: colors.surface, borderRadius: 20, overflow: "hidden", width: "100%", maxWidth: 400, ...shadows.lg }}
            onPress={() => {}}
          >
            <View style={{ backgroundColor: colors.accentDim, alignItems: "center", paddingVertical: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
              <View style={{ width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.accentDim, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: `${colors.accent}40` }}>
                <Ionicons name="refresh-outline" size={30} color={colors.accent} />
              </View>
            </View>
            <View style={{ padding: spacing.xl }}>
              <Text style={{ ...typography.h3, color: colors.textPrimary, textAlign: "center", marginBottom: spacing.sm }}>
                Recalibrate Plan?
              </Text>
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22 }}>
                We'll analyse your recent workout history and update the volume, intensity, and exercise selection to match your progress.
              </Text>
            </View>
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
              <Pressable onPress={() => setShowRecalibrateConfirm(false)} style={{ flex: 1, paddingVertical: spacing.md, alignItems: "center", borderRightWidth: 1, borderRightColor: colors.cardBorder }}>
                <Text style={{ ...typography.bodyMedium, color: colors.textSecondary, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRecalibrate}
                disabled={recalibrate.isPending}
                style={{ flex: 1, paddingVertical: spacing.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentDim }}
              >
                {recalibrate.isPending ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={{ ...typography.bodyMedium, color: colors.accent, fontWeight: "700" }}>Recalibrate</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Swap Exercise Bottom Sheet ── */}
      <Modal visible={substituteTarget !== null} transparent animationType="slide" onRequestClose={() => setSubstituteTarget(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}
          onPress={() => setSubstituteTarget(null)}
        >
          <Pressable
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}
            onPress={() => {}}
          >
            <View style={{ width: 40, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, alignSelf: "center", marginBottom: spacing.lg }} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, gap: spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.accentLight, justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="swap-horizontal" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.h3, color: colors.textPrimary }}>Swap Exercise</Text>
                {substituteTarget?.name ? (
                  <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
                    Replacing: <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{substituteTarget.name}</Text>
                  </Text>
                ) : null}
              </View>
            </View>
            <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 }}>
              Optionally tell the AI why — e.g. "no barbell", "shoulder pain", "prefer machines":
            </Text>
            <TextInput
              value={substituteReason}
              onChangeText={setSubstituteReason}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.lg,
                padding: spacing.md,
                color: colors.textPrimary,
                ...typography.body,
                marginBottom: spacing.lg,
                minHeight: 80,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setSubstituteTarget(null)}
                style={{ flex: 1, paddingVertical: spacing.md, backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.cardBorder }}
              >
                <Text style={{ ...typography.bodyMedium, color: colors.textSecondary, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubstitute}
                disabled={substituteMutation.isPending}
                style={{ flex: 1, paddingVertical: spacing.md, backgroundColor: colors.accent, borderRadius: radius.lg, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: spacing.xs, opacity: substituteMutation.isPending ? 0.7 : 1 }}
              >
                {substituteMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <Ionicons name="swap-horizontal" size={16} color={colors.textOnAccent} />
                )}
                <Text style={{ color: colors.textOnAccent, fontWeight: "700", fontSize: 15 }}>Swap It</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
