import { useIsFocused } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useTheme } from "../../theme/theme";
import { motion, spacing, typography } from "../../theme/tokens";

const MIN_SCALE = 0.8;
const SLIDE = spacing.md;
/**
 * Slot phase: 0 = below, hidden · 1 = in place, shown · 2 = above, hidden.
 * Entering runs 0→1, leaving 1→2.
 */
const HIDDEN_BELOW = 0;
const SHOWN = 1;
const HIDDEN_ABOVE = 2;

/**
 * One headline line that cycles through `messages`: the current line slides
 * up and fades out while the next slides in from below, slowly and evenly.
 *
 * Two fixed slots take turns. A slot's text is only ever replaced while that
 * slot is fully hidden, and its entrance starts after the new text has been
 * drawn, so no stale message can flash between two others. Fixed height (no
 * layout shift). Pauses while the screen is unfocused or the app is in the
 * background; with reduce motion on, shows only the first message.
 */
export function CyclingHeadline({ messages }: { messages: string[] }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");

  // Slot texts and which slot is showing. `swap` counts changes (0 = none yet).
  const [texts, setTexts] = useState<[string, string]>([messages[0] ?? "", ""]);
  const [showing, setShowing] = useState<0 | 1>(0);
  const [swap, setSwap] = useState(0);
  const cursor = useRef(0);
  const showingRef = useRef<0 | 1>(0);
  const phaseA = useSharedValue(SHOWN);
  const phaseB = useSharedValue(HIDDEN_ABOVE);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  // Before the first swap, slot A follows the first message (e.g. the name loading in).
  useEffect(() => {
    if (swap === 0) setTexts((t) => (t[0] === messages[0] ? t : [messages[0] ?? "", t[1]]));
  }, [messages, swap]);

  const count = messages.length;
  const cycling = !reduceMotion && focused && appActive && count > 1;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(() => {
      const list = messagesRef.current;
      cursor.current = (cursor.current + 1) % list.length;
      const nextText = list[cursor.current];
      // Write into the hidden slot, then flip which slot is showing.
      const target: 0 | 1 = showingRef.current === 0 ? 1 : 0;
      showingRef.current = target;
      setTexts((t) => (target === 0 ? [nextText, t[1]] : [t[0], nextText]));
      setShowing(target);
      setSwap((n) => n + 1);
    }, motion.headlineHoldMs);
    return () => clearInterval(id);
  }, [cycling]);

  // Runs after the new text has been committed and drawn in the hidden slot.
  useEffect(() => {
    if (swap === 0) return;
    const timing = { duration: motion.headlineSwapMs, easing: Easing.inOut(Easing.cubic) };
    const incoming = showing === 0 ? phaseA : phaseB;
    const outgoing = showing === 0 ? phaseB : phaseA;
    incoming.value = HIDDEN_BELOW; // hidden either way, so this jump is invisible
    incoming.value = withTiming(SHOWN, timing);
    outgoing.value = withTiming(HIDDEN_ABOVE, timing);
  }, [swap, showing, phaseA, phaseB]);

  const lineStyle = [typography.headlineMd, { color: colors.text }];

  if (reduceMotion || count <= 1) {
    return (
      <View accessible accessibilityRole="header" accessibilityLabel={messages[0]} style={{ height: typography.headlineMd.lineHeight }}>
        <Text style={lineStyle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={MIN_SCALE}>
          {messages[0]}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={messages[0]}
      style={{ height: typography.headlineMd.lineHeight, overflow: "hidden" }}
    >
      <Slot phase={phaseA} text={texts[0]} style={lineStyle} />
      <Slot phase={phaseB} text={texts[1]} style={lineStyle} />
    </View>
  );
}

function Slot({ phase, text, style }: { phase: SharedValue<number>; text: string; style: object[] }) {
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [HIDDEN_BELOW, SHOWN, HIDDEN_ABOVE], [0, 1, 0]),
    transform: [{ translateY: interpolate(phase.value, [HIDDEN_BELOW, SHOWN, HIDDEN_ABOVE], [SLIDE, 0, -SLIDE]) }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0 }, animated]}>
      <Text style={style} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={MIN_SCALE}>
        {text}
      </Text>
    </Animated.View>
  );
}
