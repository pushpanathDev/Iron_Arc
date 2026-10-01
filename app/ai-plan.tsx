/**
 * AI Plan Library Screen
 *
 * Lists all of the user's saved workout plans as cards.
 * Tapping a card → navigates to /plan-detail?id=...
 * A floating "New Plan" button opens the criteria sheet to generate another plan.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Alert,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProfile } from "../hooks/useProfile";
import {
  usePlans,
  useGeneratePlan,
  useActivatePlan,
  useDeletePlan,
} from "../hooks/usePlan";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../theme/theme";
import { Plan } from "../services/api";
import {
  PlanCriteriaSheet,
  PlanCriteria,
  DEFAULT_CRITERIA,
} from "../components/PlanCriteriaSheet";

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPlanSummary(plan: Plan): { days: number; split: string; intensity: string } {
  const criteria = plan.criteria as any;
  const planData = plan.planData as any;

  const days =
    planData?.weeks?.[0]?.days?.filter((d: any) => d.sessionType === "training").length ??
    planData?.days?.filter((d: any) => d.sessionType !== "rest").length ??
    0;

  const split = criteria?.splitPreference
    ? criteria.splitPreference.replace(/_/g, " ")
    : planData?.planExplanation
    ? "Custom"
    : "AI Generated";

  const intensity = criteria?.intensity ?? "moderate";

  return { days, split, intensity };
}

const INTENSITY_COLOR: Record<string, string> = {
  conservative: "#22C55E",
  moderate: "#F59E0B",
  aggressive: "#EF4444",
};

/* ─────────────────────────────────────────────────────────────
   Plan Card
───────────────────────────────────────────────────────────── */
function PlanCard({
  plan,
  index,
  onActivate,
  onDelete,
  colors,
  spacing,
  radius,
  shadows,
  typography,
}: {
  plan: Plan;
  index: number;
  onActivate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  colors: any;
  spacing: any;
  radius: any;
  shadows: any;
  typography: any;
}) {
  const summary = getPlanSummary(plan);
  const intensityColor = INTENSITY_COLOR[summary.intensity] ?? colors.accent;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(350)}
      style={{ marginBottom: spacing.md }}
    >
      <Pressable
        onPress={() => router.navigate(`/plan-detail?id=${plan.id}`)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: plan.isActive ? 2 : 1,
          borderColor: plan.isActive ? colors.accent : colors.cardBorder,
          overflow: "hidden",
          ...shadows.sm,
        }}
      >
        {/* Active plan top strip */}
        {plan.isActive && (
          <View
            style={{
              backgroundColor: colors.accent,
              paddingHorizontal: spacing.lg,
              paddingVertical: 5,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>
              ACTIVE PLAN
            </Text>
          </View>
        )}

        <View style={{ padding: spacing.lg }}>
          {/* Plan name + actions */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.full,
                backgroundColor: plan.isActive ? colors.accentLight : colors.surfaceElevated,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.md,
              }}
            >
              <Ionicons
                name="barbell-outline"
                size={20}
                color={plan.isActive ? colors.accent : colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...typography.bodyMedium,
                  color: colors.textPrimary,
                  fontWeight: "700",
                  fontSize: 16,
                }}
                numberOfLines={1}
              >
                {plan.name}
              </Text>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                Created {formatDate(plan.createdAt)}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                onDelete(plan.id, plan.name)
              }
              style={{ padding: spacing.sm }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Meta chips */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
            {summary.days > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                }}
              >
                <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginLeft: 4, fontWeight: "600" }}>
                  {summary.days}×/week
                </Text>
              </View>
            )}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
              }}
            >
              <Ionicons name="layers-outline" size={12} color={colors.textSecondary} />
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textSecondary,
                  marginLeft: 4,
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}
              >
                {summary.split}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: intensityColor + "20",
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
              }}
            >
              <Ionicons name="flame-outline" size={12} color={intensityColor} />
              <Text
                style={{
                  ...typography.caption,
                  color: intensityColor,
                  marginLeft: 4,
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}
              >
                {summary.intensity}
              </Text>
            </View>
          </View>

          {/* Actions row */}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              onPress={() => router.navigate(`/plan-detail?id=${plan.id}`)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: plan.isActive ? colors.accentLight : colors.surfaceElevated,
                borderRadius: radius.lg,
                paddingVertical: spacing.sm,
                gap: spacing.xs,
              }}
            >
              <Ionicons
                name="eye-outline"
                size={16}
                color={plan.isActive ? colors.accent : colors.textSecondary}
              />
              <Text
                style={{
                  ...typography.caption,
                  color: plan.isActive ? colors.accent : colors.textSecondary,
                  fontWeight: "600",
                }}
              >
                View Details
              </Text>
            </Pressable>
            {!plan.isActive && (
              <Pressable
                onPress={() => onActivate(plan.id)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.accentLight,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.sm,
                  gap: spacing.xs,
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
                <Text
                  style={{ ...typography.caption, color: colors.accent, fontWeight: "700" }}
                >
                  Set Active
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────── */
export default function AIPlanScreen() {
  const { colors, spacing, radius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const { data: profile } = useProfile();
  const { data: plans = [], isLoading, refetch, isRefetching } = usePlans();
  const generatePlan = useGeneratePlan();
  const activatePlan = useActivatePlan();
  const deletePlan = useDeletePlan();

  const [showCriteriaSheet, setShowCriteriaSheet] = useState(false);
  const [criteria, setCriteria] = useState<PlanCriteria>(DEFAULT_CRITERIA);
  const [showProfileIncomplete, setShowProfileIncomplete] = useState(false);

  const profileComplete =
    Boolean(profile?.fitnessGoal) &&
    Boolean(profile?.age) &&
    Boolean(profile?.weight);

  const handleNewPlan = () => {
    if (!profileComplete) {
      showToast({
        message: "Complete your profile (goal, age, weight) before generating a plan.",
        type: "warning",
      });
      return;
    }
    setShowCriteriaSheet(true);
  };

  const handleGenerate = () => {
    generatePlan.mutate(criteria, {
      onSuccess: () => {
        showToast({ message: "New plan created!", type: "success" });
        setShowCriteriaSheet(false);
      },
      onError: () => {
        showToast({ message: "Failed to generate plan. Please try again.", type: "error" });
      },
    });
  };

  const handleActivate = (planId: string) => {
    activatePlan.mutate(planId, {
      onSuccess: () => showToast({ message: "Plan set as active.", type: "success" }),
      onError: () => showToast({ message: "Failed to activate plan.", type: "error" }),
    });
  };

  const handleDelete = (planId: string, planName: string) => {
    Alert.alert(
      "Delete Plan?",
      `"${planName}" will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deletePlan.mutate(planId, {
              onSuccess: () => showToast({ message: "Plan deleted.", type: "info" }),
              onError: () => showToast({ message: "Failed to delete plan.", type: "error" }),
            });
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={["#7C3AED", "#4F46E5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.xl,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.xs }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: spacing.md, padding: spacing.xs }}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "500" }}>
              {/* Powered by Groq AI · Llama 3.3 70B */}
              Powered By AI
            </Text>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
              My Plans
            </Text>
          </View>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: radius.full,
              width: 36,
              height: 36,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {plans.length}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.accent}
          />
        }
      >
        {isLoading ? (
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md }}>
              Loading your plans…
            </Text>
          </View>
        ) : plans.length === 0 ? (
          /* Empty state */
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={{ alignItems: "center", marginTop: 60 }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: radius.full,
                backgroundColor: "#7C3AED20",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.lg,
              }}
            >
              <Ionicons name="sparkles" size={36} color="#7C3AED" />
            </View>
            <Text style={{ ...typography.h2, color: colors.textPrimary, textAlign: "center" }}>
              No Plans Yet
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: spacing.sm,
                marginBottom: spacing.xl,
                paddingHorizontal: spacing.lg,
                lineHeight: 22,
              }}
            >
              Generate your first AI-powered workout plan. You can have multiple plans and switch between them.
            </Text>

            <Pressable
              onPress={handleNewPlan}
              style={{
                backgroundColor: "#7C3AED",
                borderRadius: radius.xl,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                Generate My First Plan
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* Plan cards */}
            {plans.map((plan, i) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                index={i}
                onActivate={handleActivate}
                onDelete={handleDelete}
                colors={colors}
                spacing={spacing}
                radius={radius}
                shadows={shadows}
                typography={typography}
              />
            ))}

            {/* Info note */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.lg,
                padding: spacing.md,
                gap: spacing.sm,
                marginTop: spacing.sm,
              }}
            >
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={{ ...typography.caption, color: colors.textMuted, flex: 1 }}>
                Tap a plan to view its full schedule and swap exercises. Only the active plan is followed.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating New Plan button */}
      {plans.length > 0 && (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + spacing.lg,
            right: spacing.lg,
          }}
        >
          <Pressable
            onPress={handleNewPlan}
            disabled={generatePlan.isPending}
            style={{
              backgroundColor: "#7C3AED",
              borderRadius: radius.full,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              elevation: 6,
              shadowColor: "#7C3AED",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
            }}
          >
            {generatePlan.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="add" size={20} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              New Plan
            </Text>
          </Pressable>
        </View>
      )}

      {/* Criteria sheet */}
      <PlanCriteriaSheet
        visible={showCriteriaSheet}
        criteria={criteria}
        onChange={(updated) => setCriteria((prev) => ({ ...prev, ...updated }))}
        onGenerate={handleGenerate}
        onClose={() => setShowCriteriaSheet(false)}
        isGenerating={generatePlan.isPending}
        isRegenerate={false}
      />
    </View>
  );
}
