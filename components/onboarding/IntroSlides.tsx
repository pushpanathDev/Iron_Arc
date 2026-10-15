import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BackHandler,
  FlatList,
  Image,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, touchTarget, tracking, typography } from "../../theme/tokens";
import { Button, PressableScale } from "../ui";
import { LogDemoCard, PlanDemoCard, TrackDemoCard } from "./IntroDemoCards";

const APP_ICON = require("../../assets/images/icon.png");

type Slide = { key: string; tab: string; title: string; body: string; card: () => ReactNode };

const SLIDES: Slide[] = [
  {
    key: "log",
    tab: "Log",
    title: "Frictionless logging",
    body: "Built for the gym floor. Log weights, sets and rest with zero clutter.",
    card: () => <LogDemoCard />,
  },
  {
    key: "track",
    tab: "Track",
    title: "Real progress",
    body: "Tonnage, overload graphs and true personal records, all from your own training.",
    card: () => <TrackDemoCard />,
  },
  {
    key: "plan",
    tab: "Plan",
    title: "Plans that fit you",
    body: "Generate an AI workout plan or log freely. Iron Arc adapts to how you train.",
    card: () => <PlanDemoCard />,
  },
];

export type IntroSlidesProps = {
  /** Skip or "Get started": go to profile setup. */
  onDone: () => void;
};

export function IntroSlides({ onDone }: IntroSlidesProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const goTo = useCallback(
    (i: number) => {
      listRef.current?.scrollToOffset({ offset: i * width, animated: true });
      setIndex(i);
    },
    [width],
  );

  // Keep the tabs in sync while swiping.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
  };

  // Android back steps to the previous slide; on the first slide it does the default.
  useEffect(() => {
    if (index === 0) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goTo(index - 1);
      return true;
    });
    return () => sub.remove();
  }, [index, goTo]);

  const onContinue = () => (isLast ? onDone() : goTo(index + 1));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Top bar */}
      <View
        style={{
          height: touchTarget,
          marginBottom: spacing.lg,
          paddingHorizontal: spacing.screen,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Image
            source={APP_ICON}
            style={{ width: size.iconLg, height: size.iconLg, borderRadius: radius.md }}
            accessibilityIgnoresInvertColors
          />
          <Text style={[typography.labelMd, { color: colors.textSecondary, letterSpacing: tracking.labelWide }]}>Iron Arc</Text>
        </View>
        <PressableScale
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Skip intro"
          style={{ minHeight: touchTarget, paddingHorizontal: spacing.md, justifyContent: "center" }}
        >
          {({ pressed }) => (
            <Text style={[typography.labelLg, { color: pressed ? colors.text : colors.textSecondary }]}>Skip</Text>
          )}
        </PressableScale>
      </View>

      {/* Tabs: the only page indicator */}
      <View
        accessibilityRole="tablist"
        style={{
          alignSelf: "center",
          flexDirection: "row",
          gap: spacing.sm,
          padding: spacing.xs,
          marginBottom: spacing.xl,
          borderRadius: radius.lg,
          backgroundColor: colors.card,
        }}
      >
        {SLIDES.map((s, i) => {
          const active = i === index;
          return (
            <PressableScale
              key={s.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                goTo(i);
              }}
              accessibilityRole="tab"
              accessibilityLabel={s.tab}
              accessibilityState={{ selected: active }}
              style={{
                minHeight: touchTarget,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                backgroundColor: active ? colors.surfaceContainerHigh : "transparent",
              }}
            >
              <View
                style={{
                  width: size.dot,
                  height: size.dot,
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.accentContainer : colors.surfaceContainerHighest,
                }}
              />
              <Text style={[typography.labelMd, { color: active ? colors.accent : colors.textSecondary }]}>{s.tab}</Text>
            </PressableScale>
          );
        })}
      </View>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <ScrollView
            style={{ width }}
            contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.form }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {item.card()}
            <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
              <Text accessibilityRole="header" style={[typography.headlineLg, { color: colors.text }]}>
                {item.title}
              </Text>
              <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{item.body}</Text>
            </View>
          </ScrollView>
        )}
      />

      {/* Pinned action above the bottom inset */}
      <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: spacing.xl }}>
        <Button
          title={isLast ? "Get started" : "Continue"}
          trailingIcon="arrow-forward"
          haptic
          onPress={onContinue}
          fullWidth
        />
      </View>
    </View>
  );
}
