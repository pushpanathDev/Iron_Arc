/**
 * Plan coach (AI_Plan Coach Chat mockup): talk to the AI about the plan;
 * when it changes the plan, a card says so and links back to the day view.
 * Navigate here with /plan-chat?id=<planId>.
 */
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { aiErrorMessage } from "../components/plans/PlanActions";
import { useToast } from "../context/ToastContext";
import { usePlan, usePlanChat } from "../hooks/usePlan";
import type { ChatMessage } from "../services/api";
import { useTheme } from "../theme/theme";
import { radius, size, spacing, typography } from "../theme/tokens";

type Message = ChatMessage & { planUpdated?: boolean; failed?: boolean; local?: boolean };

const MESSAGE_MAX = 500;
const QUICK_REPLIES = ["Make it 3 days a week", "Shorter sessions", "Replace squats", "Make this week easier", "More arm work"];
const GREETING = "I'm your plan coach. Ask me to change your days, swap exercises, shorten sessions or adjust the difficulty.";

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export default function PlanChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: plan } = usePlan(id);
  const chat = usePlanChat(id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const loaded = useRef(false);

  // Saved history (top-level field, or inside planData on older plans), once.
  useEffect(() => {
    if (!plan || loaded.current) return;
    const history = (plan.chatHistory ?? (plan.planData as { _chatHistory?: ChatMessage[] } | null)?._chatHistory ?? []) as ChatMessage[];
    setMessages(history);
    loaded.current = true;
  }, [plan]);
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length, chat.isPending]);

  const send = (text: string, retryOf?: number) => {
    const message = text.trim();
    if (!message || chat.isPending || !id) return;
    setInput("");
    const mine: Message = { role: "user", content: message, timestamp: new Date().toISOString(), local: true };
    setMessages((m) => (retryOf !== undefined ? m.map((x, i) => (i === retryOf ? { ...mine } : x)) : [...m, mine]));
    chat.mutate(message, {
      onSuccess: (r) => {
        setMessages((m) => [
          ...m.map((x) => (x === mine || (x.local && x.content === message && x.role === "user") ? { ...x, failed: false } : x)),
          { role: "assistant", content: r.message, timestamp: new Date().toISOString(), planUpdated: r.planUpdated, local: true },
        ]);
      },
      onError: (e) => {
        if (__DEV__) console.log("[Coach] shown as \"Message not sent\" because of:", e);
        setMessages((m) => m.map((x) => (x.local && x.role === "user" && x.content === message && !x.failed ? { ...x, failed: true } : x)));
        showToast({ type: "error", message: "Message not sent", subtitle: aiErrorMessage(e) });
      },
    });
  };

  const shown = useMemo<Message[]>(() => (messages.length ? messages : [{ role: "assistant", content: GREETING, timestamp: new Date().toISOString(), local: true }]), [messages]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ minHeight: size.appBar, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingLeft: spacing.xs, paddingRight: spacing.screen }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({ width: size.control, height: size.control, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent" })}
        >
          <MaterialIcons name="arrow-back" size={size.iconLg} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={[typography.headlineSm, { color: colors.text }]} accessibilityRole="header">
              Plan coach
            </Text>
            {plan?.isActive && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full, backgroundColor: colors.accentSubtle }}>
                <View style={{ width: size.dot, height: size.dot, borderRadius: radius.full, backgroundColor: colors.accent }} />
                <Text style={[typography.labelSm, { color: colors.accent }]}>Active</Text>
              </View>
            )}
          </View>
          {plan && (
            <Text style={[typography.labelSm, { color: colors.textSecondary }]} numberOfLines={1}>
              {plan.name} · Week {plan.weekNumber || 1}
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingVertical: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          {shown.map((m, i) => (
            <Bubble key={`${m.timestamp}-${i}`} message={m} onRetry={m.failed ? () => send(m.content, i) : undefined} />
          ))}
          {chat.isPending && <Thinking />}
        </ScrollView>

        {/* Quick replies */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.screen, paddingBottom: spacing.sm }} style={{ flexGrow: 0 }}>
          {QUICK_REPLIES.map((q) => (
            <Pressable
              key={q}
              onPress={() => send(q)}
              disabled={chat.isPending}
              accessibilityRole="button"
              style={({ pressed }) => ({
                minHeight: size.control - spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                opacity: chat.isPending ? 0.5 : 1,
                backgroundColor: pressed ? colors.surfaceContainerHigh : "transparent",
              })}
            >
              <Text style={[typography.labelMd, { color: colors.text }]}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Composer */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.screen, paddingTop: spacing.xs, paddingBottom: insets.bottom + spacing.sm }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your plan…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MESSAGE_MAX}
            style={[
              typography.bodyMd,
              { flex: 1, minHeight: size.control, maxHeight: size.goalCard, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md, borderRadius: radius.lg, color: colors.text, backgroundColor: colors.surfaceContainerHigh },
            ]}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || chat.isPending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={({ pressed }) => ({
              width: size.control,
              height: size.control,
              borderRadius: radius.lg,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: !input.trim() || chat.isPending ? colors.surfaceContainerHigh : pressed ? colors.accentPressed : colors.accent,
            })}
          >
            <MaterialIcons name="send" size={size.icon} color={!input.trim() || chat.isPending ? colors.textMuted : colors.onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ message, onRetry }: { message: Message; onRetry?: () => void }) {
  const { colors } = useTheme();
  const mine = message.role === "user";
  return (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, maxWidth: "88%" }}>
        {!mine && (
          <View style={{ width: size.tileSm, height: size.tileSm, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
            <MaterialIcons name="auto-awesome" size={size.iconSm} color={colors.accent} />
          </View>
        )}
        <View
          style={{
            flexShrink: 1,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.lg,
            borderWidth: message.failed ? 1 : 0,
            borderColor: colors.danger,
            backgroundColor: mine ? colors.accentSubtle : colors.raised,
          }}
        >
          <Text style={[typography.bodyMd, { color: colors.text }]}>{message.content}</Text>
          <Text style={[typography.labelSm, { fontSize: size.chartLabel, color: colors.textMuted, alignSelf: "flex-end", marginTop: spacing.xxs }]}>{time(message.timestamp)}</Text>
        </View>
      </View>

      {message.failed && onRetry && (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Couldn't send. Try again" hitSlop={spacing.sm} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <MaterialIcons name="error-outline" size={size.iconXs} color={colors.danger} />
          <Text style={[typography.labelSm, { color: colors.danger }]}>Couldn&apos;t send ·</Text>
          <Text style={[typography.labelSm, { color: colors.danger, textDecorationLine: "underline" }]}>Try again</Text>
        </Pressable>
      )}

      {message.planUpdated && (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Plan updated. View the plan"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginLeft: size.tileSm + spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.accentSubtle,
            backgroundColor: pressed ? colors.surfaceContainerHigh : colors.raised,
          })}
        >
          <MaterialIcons name="check-circle" size={size.iconLg} color={colors.accent} />
          <View style={{ gap: spacing.xxs }}>
            <Text style={[typography.bodyMdMedium, { color: colors.text }]}>Plan updated</Text>
            <Text style={[typography.labelSm, { color: colors.accent }]}>View plan</Text>
          </View>
          <MaterialIcons name="chevron-right" size={size.iconSm} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

function Thinking() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }} accessibilityLabel="The coach is replying">
      <View style={{ width: size.tileSm, height: size.tileSm, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceContainerHigh }}>
        <MaterialIcons name="auto-awesome" size={size.iconSm} color={colors.accent} />
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.raised }}>
        <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>Thinking…</Text>
      </View>
    </View>
  );
}
