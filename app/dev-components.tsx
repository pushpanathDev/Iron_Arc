import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Redirect } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AppTabBar,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  OfflineState,
  ProgressRing,
  SectionHeader,
  Skeleton,
  StatTile,
  TextField,
  SkeletonBlock,
  type ButtonVariant,
} from "../components/ui";
import { useConnection, type ServerSimulation } from "../context/ConnectionContext";
import { ForcedThemeProvider } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../theme/theme";
import { semibold, spacing, typography } from "../theme/tokens";

// Dev-only component gallery. Not linked from navigation; open via /dev-components.
export default function DevComponentsScreen() {
  const [scheme, setScheme] = useState<"dark" | "light">("dark");
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ForcedThemeProvider resolved={scheme}>
      <Gallery
        scheme={scheme}
        onToggle={() => setScheme((s) => (s === "dark" ? "light" : "dark"))}
      />
    </ForcedThemeProvider>
  );
}

function Gallery({
  scheme,
  onToggle,
}: {
  scheme: "dark" | "light";
  onToggle: () => void;
}) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
      >
        <SectionHeader
          title={`Components (${scheme})`}
          actionLabel={`Show ${scheme === "dark" ? "light" : "dark"}`}
          onAction={onToggle}
        />
        <Buttons />
        <Cards />
        <Chips />
        <Fields />
        <Stats />
        <States />
        <Skeletons />
        <ConnectionTools />
        <Toasts />
        <TabBarPreview />
      </ScrollView>
    </SafeAreaView>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.headlineMd, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const noop = () => {};

function Buttons() {
  const variants: ButtonVariant[] = [
    "primary",
    "secondary",
    "ghost",
    "destructive",
  ];
  return (
    <Block title="Button">
      {variants.map((v) => (
        <View
          key={v}
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          <Button title={v} variant={v} onPress={noop} />
          <Button title="Icon" variant={v} icon="add" onPress={noop} />
          <Button title="Loading" variant={v} loading onPress={noop} />
          <Button title="Disabled" variant={v} disabled onPress={noop} />
        </View>
      ))}
      <Button title="Full width" fullWidth onPress={noop} />
    </Block>
  );
}

function Cards() {
  const { colors } = useTheme();
  return (
    <Block title="Card">
      <Card>
        <Text style={[typography.bodyLg, { color: colors.text }]}>
          Static card, radius lg
        </Text>
      </Card>
      <Card radius="md" onPress={noop} accessibilityLabel="Pressable card">
        <Text style={[typography.bodyLg, { color: colors.text }]}>
          Pressable card, radius md
        </Text>
      </Card>
    </Block>
  );
}

function Chips() {
  const [selected, setSelected] = useState<string[]>(["Chest"]);
  const toggle = (c: string) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  return (
    <Block title="Chip">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {["Chest", "Back", "Legs", "Shoulders"].map((c) => (
          <Chip
            key={c}
            label={c}
            selected={selected.includes(c)}
            onPress={() => toggle(c)}
          />
        ))}
        <Chip label="With icon" icon="barbell-outline" onPress={noop} />
        <Chip label="Disabled" disabled onPress={noop} />
      </View>
    </Block>
  );
}

function Fields() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("secret123");
  return (
    <Block title="TextField">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@gmail.com"
        helperText="We never share your email."
        keyboardType="email-address"
      />
      <TextField
        label="Password"
        variant="password"
        value={pw}
        onChangeText={setPw}
      />
      <TextField
        label="Weight"
        value="abc"
        onChangeText={noop}
        error="Enter a number."
      />
      <TextField label="Disabled" value="Read only" editable={false} />
    </Block>
  );
}

function Stats() {
  const { colors } = useTheme();
  return (
    <Block title="StatTile and ProgressRing">
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <StatTile value={12} label="Workouts" icon="barbell-outline" />
        <StatTile value={5} label="Day streak" icon="flame" tone="streak" />
        <StatTile
          value={100}
          unit="kg"
          label="Bench record"
          icon="trophy"
          tone="record"
        />
      </View>
      <View
        style={{ flexDirection: "row", gap: spacing.lg, alignItems: "center" }}
      >
        {[0, 0.5, 1].map((p) => (
          <ProgressRing
            key={p}
            progress={p}
            accessibilityLabel={`${Math.round(p * 4)} of 4 workouts this week`}
          >
            <Text
              style={[typography.bodyMd, { color: colors.text, ...semibold }]}
            >
              {Math.round(p * 4)}/4
            </Text>
          </ProgressRing>
        ))}
      </View>
    </Block>
  );
}

function States() {
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    setRetrying(true);
    setTimeout(() => setRetrying(false), 1500);
  };
  return (
    <Block title="Empty, error and offline">
      <Card>
        <EmptyState
          icon="barbell-outline"
          title="No workouts yet"
          body="Log your first workout to see it here."
          actionLabel="Log workout"
          onAction={noop}
        />
      </Card>
      <Card>
        <EmptyState
          icon="scale-outline"
          title="No weigh-ins"
          body="Your weight entries will show up here."
        />
      </Card>
      <Card>
        <ErrorState
          message="We couldn't load your history."
          onRetry={retry}
          retrying={retrying}
        />
      </Card>
      <Card>
        <OfflineState mode="offline" onRetry={retry} retrying={retrying} />
      </Card>
      <Card>
        <OfflineState mode="waking" />
      </Card>
    </Block>
  );
}

function Skeletons() {
  return (
    <Block title="Skeleton">
      <Card style={{ gap: spacing.sm }}>
        <Skeleton width="60%" height={20} />
        <Skeleton />
        <Skeleton width="80%" />
      </Card>
    </Block>
  );
}

function ConnectionTools() {
  const { colors } = useTheme();
  const connection = useConnection();
  const options: { value: ServerSimulation; label: string }[] = [
    { value: "none", label: "Real server" },
    { value: "slow", label: "Simulate server slow (20s)" },
    { value: "down", label: "Simulate server down" },
  ];
  return (
    <Block title="Connection (dev only)">
      <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>
        State: {connection.state} · reachable: {String(connection.serverReachable)} · checking: {String(connection.checking)}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={connection.simulation === o.value} onPress={() => connection.setSimulation(o.value)} />
        ))}
      </View>
      <Text style={[typography.labelSm, { color: colors.textSecondary }]}>
        Saved across restarts. To see the startup screens, sign out (clears saved data), pick a simulation, then sign in.
      </Text>
      <Button title="Retry now" variant="tonal" onPress={connection.retry} />
    </Block>
  );
}

function Toasts() {
  const { showToast } = useToast();
  return (
    <Block title="Toasts">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Button title="Success" variant="tonal" onPress={() => showToast({ type: "success", message: "Workout saved", subtitle: "Bench press · 3 sets" })} />
        <Button
          title="Error"
          variant="tonal"
          onPress={() =>
            showToast({
              type: "error",
              message: "Couldn't save workout",
              subtitle: "Can't reach the server.",
              icon: "cloud-off",
              actionLabel: "Retry",
              onAction: () => showToast({ type: "info", message: "Retry tapped" }),
            })
          }
        />
        <Button
          title="Undo"
          variant="tonal"
          onPress={() =>
            showToast({ type: "undo", message: "Workout deleted", subtitle: "Bench press", actionLabel: "Undo", onAction: () => {} })
          }
        />
      </View>
      <SkeletonBlock height={typography.bodyLg.lineHeight} />
    </Block>
  );
}

function TabBarPreview() {
  const [index, setIndex] = useState(0);
  const tabs = [
    { name: "index", title: "Home", icon: "home" },
    { name: "body-weight", title: "Weight", icon: "scale-outline" },
    { name: "analytics", title: "Analytics", icon: "stats-chart" },
    { name: "history", title: "History", icon: "time-outline" },
  ] as const;
  const routes = tabs.map((t) => ({ key: t.name, name: t.name }));
  const descriptors = Object.fromEntries(
    tabs.map((t) => [
      t.name,
      {
        options: {
          title: t.title,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={t.icon} size={size} color={color} />
          ),
        },
      },
    ]),
  );
  const navigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (name: string) =>
      setIndex(routes.findIndex((r) => r.name === name)),
  };
  const props = {
    state: { index, routes },
    descriptors,
    navigation,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;

  return (
    <Block title="AppTabBar">
      <View style={{ paddingTop: 28 }}>
        <AppTabBar {...props} onLogPress={noop} />
      </View>
    </Block>
  );
}
