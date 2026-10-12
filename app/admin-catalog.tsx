import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuth } from "../auth/AuthContext";
import { EXERCISES, ExerciseCategory } from "../data/exercises";
import { isAdminUser } from "../firebase/admin";
import {
  AdminExerciseCatalog,
  getExerciseCatalogAdmin,
  saveExerciseCatalogAdmin,
} from "../firebase/exerciseCatalogAdmin";
import { useTheme } from "../theme/theme";
import { router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const ALL_CATEGORIES = Object.keys(
  EXERCISES,
) as ExerciseCategory[];

function normalizeInput(value: string) {
  return value.trim();
}

function addToList(list: string[], value: string) {
  const cleaned = normalizeInput(value);
  if (!cleaned) return list;
  const key = cleaned.toLowerCase();
  if (list.some((v) => v.toLowerCase() === key)) return list;
  return [...list, cleaned];
}

function removeFromList(list: string[], value: string) {
  const key = value.toLowerCase();
  return list.filter((v) => v.toLowerCase() !== key);
}

function normalizeList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of list) {
    const item = String(raw).trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function findMatch(list: string[], value: string): string | null {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  const match = list.find((v) => v.toLowerCase() === key);
  return match ?? null;
}

function filterMatches(list: string[], query: string): string[] {
  const key = query.trim().toLowerCase();
  if (!key) return [];
  return list.filter((v) => v.toLowerCase().includes(key));
}

function mergeLists(base: string[], incoming: string[]): string[] {
  const seen = new Set(base.map((v) => v.toLowerCase()));
  const result = [...base];
  for (const item of incoming) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeCategoryMap(
  input: unknown,
  unknownKeys: string[],
): Record<string, string[]> {
  if (!input || typeof input !== "object") return {};
  const result: Record<string, string[]> = {};
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (!ALL_CATEGORIES.includes(key as ExerciseCategory)) {
      unknownKeys.push(key);
      continue;
    }
    result[key] = normalizeList((input as any)[key]);
  }
  return result;
}

export default function AdminCatalogScreen() {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [adminStatus, setAdminStatus] = useState<
    "checking" | "allowed" | "denied"
  >("checking");
  const [catalog, setCatalog] = useState<AdminExerciseCatalog | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<ExerciseCategory>(ALL_CATEGORIES[0]);
  const [newAddition, setNewAddition] = useState("");
  const [newRemoval, setNewRemoval] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [additionError, setAdditionError] = useState<string | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkInfo, setBulkInfo] = useState<string | null>(null);
  const [bulkReplace, setBulkReplace] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!user) {
        if (active) setAdminStatus("denied");
        return;
      }
      const allowed = await isAdminUser();
      if (!active) return;
      setAdminStatus(allowed ? "allowed" : "denied");
    };
    check();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    if (adminStatus !== "allowed") return;
    const load = async () => {
      const data = await getExerciseCatalogAdmin();
      if (active) setCatalog(data);
    };
    load();
    return () => {
      active = false;
    };
  }, [adminStatus]);

  const baseList = useMemo(() => {
    return EXERCISES[selectedCategory] ?? [];
  }, [selectedCategory]);

  const additions = catalog?.categories?.[selectedCategory] ?? [];
  const removed = catalog?.removed?.[selectedCategory] ?? [];
  const additionInBase = useMemo(
    () => findMatch(baseList, newAddition),
    [baseList, newAddition],
  );
  const additionInAdditions = useMemo(
    () => findMatch(additions, newAddition),
    [additions, newAddition],
  );
  const additionMatches = useMemo(
    () => filterMatches(baseList, newAddition).slice(0, 6),
    [baseList, newAddition],
  );
  const removalExact = useMemo(
    () => findMatch(baseList, newRemoval),
    [baseList, newRemoval],
  );
  const removalMatches = useMemo(
    () => filterMatches(baseList, newRemoval).slice(0, 6),
    [baseList, newRemoval],
  );
  const removalInAdditions = useMemo(
    () => findMatch(additions, newRemoval),
    [additions, newRemoval],
  );

  const setCategoryList = (
    kind: "categories" | "removed",
    value: string[],
  ) => {
    if (!catalog) return;
    setCatalog({
      ...catalog,
      [kind]: {
        ...(catalog[kind] ?? {}),
        [selectedCategory]: value,
      },
    });
  };

  const handleAdd = () => {
    setAdditionError(null);
    const trimmed = normalizeInput(newAddition);
    if (!trimmed) return;
    if (additionInBase) {
      setAdditionError("Already exists in base list");
      return;
    }
    if (additionInAdditions) {
      setAdditionError("Already added in remote list");
      return;
    }
    const updated = addToList(additions, trimmed);
    setCategoryList("categories", updated);
    setNewAddition("");
  };

  const handleRemove = () => {
    setRemovalError(null);
    const match = removalExact;
    if (!match) {
      if (removalInAdditions) {
        setRemovalError(
          "This is in remote additions. Remove it from the list above instead.",
        );
      } else {
        setRemovalError("Select an exercise from the base list.");
      }
      return;
    }
    if (findMatch(removed, match)) {
      setRemovalError("Already removed");
      return;
    }
    const updated = addToList(removed, match);
    setCategoryList("removed", updated);
    setNewRemoval("");
  };

  const handleSave = async () => {
    if (!catalog) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveExerciseCatalogAdmin(catalog);
      setMessage("Catalog updated");
    } catch (e) {
      setMessage("Failed to save catalog");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const applyBulkJson = () => {
    if (!catalog) return;
    setBulkError(null);
    setBulkInfo(null);

    const raw = bulkJson.trim();
    if (!raw) {
      setBulkError("Paste JSON first");
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setBulkError("Invalid JSON");
      return;
    }

    const unknownKeys: string[] = [];

    const isCatalogShape =
      parsed &&
      typeof parsed === "object" &&
      (parsed.categories || parsed.removed || parsed.mode);

    const categoriesInput = isCatalogShape
      ? parsed.categories
      : parsed;
    const removedInput = isCatalogShape ? parsed.removed : undefined;
    const nextMode =
      parsed?.mode === "replace"
        ? "replace"
        : parsed?.mode === "merge"
          ? "merge"
          : catalog.mode;

    const normalizedCategories = normalizeCategoryMap(
      categoriesInput,
      unknownKeys,
    );
    const normalizedRemoved = normalizeCategoryMap(
      removedInput,
      unknownKeys,
    );

    if (
      Object.keys(normalizedCategories).length === 0 &&
      Object.keys(normalizedRemoved).length === 0
    ) {
      setBulkError("No valid categories found in JSON");
      return;
    }

    let nextCategories = catalog.categories ?? {};
    let nextRemoved = catalog.removed ?? {};

    if (bulkReplace) {
      nextCategories = normalizedCategories;
      nextRemoved = normalizedRemoved;
    } else {
      for (const key of Object.keys(normalizedCategories)) {
        const incoming = normalizedCategories[key];
        const current = nextCategories[key] ?? [];
        nextCategories = {
          ...nextCategories,
          [key]: mergeLists(current, incoming),
        };
      }
      for (const key of Object.keys(normalizedRemoved)) {
        const incoming = normalizedRemoved[key];
        const current = nextRemoved[key] ?? [];
        nextRemoved = {
          ...nextRemoved,
          [key]: mergeLists(current, incoming),
        };
      }
    }

    setCatalog({
      ...catalog,
      mode: nextMode,
      categories: nextCategories,
      removed: nextRemoved,
    });

    if (unknownKeys.length > 0) {
      setBulkInfo(`Ignored categories: ${unknownKeys.join(", ")}`);
    } else {
      setBulkInfo("JSON applied. Review then press Save.");
    }
  };

  if (adminStatus === "checking") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (adminStatus === "denied") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.lg,
        }}
      >
        <Ionicons name="lock-closed" size={32} color={colors.textMuted} />
        <Text
          style={{
            ...typography.h3,
            color: colors.textPrimary,
            marginTop: spacing.md,
          }}
        >
          Admin Access Required
        </Text>
        <Text
          style={{
            ...typography.body,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.xs,
          }}
        >
          Your account isn’t on the admin allowlist.
        </Text>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
          style={{
            marginTop: spacing.lg,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
          }}
        >
          <Text style={{ color: colors.textPrimary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!catalog) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
    >
      <Animated.View entering={FadeInDown.duration(300)}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.md,
          }}
        >
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            style={{ marginRight: spacing.sm }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>
          <Text style={{ ...typography.h1, color: colors.textPrimary }}>
            Exercise Catalog
          </Text>
        </View>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Manage remote additions and removals. Users stay offline‑safe.
        </Text>
      </Animated.View>

      {/* Mode Toggle */}
      <Animated.View
        entering={FadeInUp.delay(80).duration(300)}
        style={{
          marginTop: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.sm,
          }}
        >
          MODE
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {(["merge", "replace"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setCatalog({ ...catalog, mode })}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor:
                  catalog.mode === mode
                    ? colors.accent
                    : colors.surfaceElevated,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color:
                    catalog.mode === mode
                      ? colors.textOnAccent
                      : colors.textSecondary,
                  fontWeight: "600",
                }}
              >
                {mode.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {removalError && (
          <Text
            style={{
              marginTop: spacing.xs,
              ...typography.caption,
              color: colors.error,
            }}
          >
            {removalError}
          </Text>
        )}
        {removalInAdditions && !removalExact && !removalError && (
          <Text
            style={{
              marginTop: spacing.xs,
              ...typography.caption,
              color: colors.textSecondary,
            }}
          >
            This matches a remote addition. Remove it from the additions list
            above.
          </Text>
        )}

        {!removalExact &&
          newRemoval.trim().length > 0 &&
          removalMatches.length > 0 && (
            <View style={{ marginTop: spacing.xs }}>
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textMuted,
                  marginBottom: spacing.xs,
                }}
              >
                Select from base list
              </Text>
              <View style={{ gap: spacing.xs }}>
                {removalMatches.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => {
                      setNewRemoval(item);
                      setRemovalError(null);
                    }}
                    style={{
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.sm,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary }}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

        {additionInBase && (
          <Text
            style={{
              marginTop: spacing.xs,
              ...typography.caption,
              color: colors.warning,
            }}
          >
            Already in base list. No need to add.
          </Text>
        )}
        {additionInAdditions && (
          <Text
            style={{
              marginTop: spacing.xs,
              ...typography.caption,
              color: colors.textMuted,
            }}
          >
            Already added in remote list.
          </Text>
        )}
        {additionError && (
          <Text
            style={{
              marginTop: spacing.xs,
              ...typography.caption,
              color: colors.error,
            }}
          >
            {additionError}
          </Text>
        )}

        {!additionInBase &&
          !additionInAdditions &&
          newAddition.trim().length > 0 &&
          additionMatches.length > 0 && (
            <View style={{ marginTop: spacing.xs }}>
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textMuted,
                  marginBottom: spacing.xs,
                }}
              >
                Matches in base list (already included)
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {additionMatches.map((item) => (
                  <View
                    key={item}
                    style={{
                      paddingVertical: 2,
                      paddingHorizontal: spacing.xs,
                      borderRadius: radius.sm,
                      backgroundColor: colors.surfaceElevated,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
      </Animated.View>

      {/* Category Picker */}
      <Animated.View
        entering={FadeInUp.delay(120).duration(300)}
        style={{
          marginTop: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.sm,
          }}
        >
          CATEGORY
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {ALL_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={{
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor:
                    selectedCategory === cat
                      ? colors.accent
                      : colors.surfaceElevated,
                }}
              >
                <Text
                  style={{
                    color:
                      selectedCategory === cat
                        ? colors.textOnAccent
                        : colors.textSecondary,
                    fontWeight: "600",
                  }}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Animated.View>

      {/* Remote Additions */}
      <Animated.View
        entering={FadeInUp.delay(160).duration(300)}
        style={{
          marginTop: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.sm,
          }}
        >
          REMOTE ADDITIONS (NEW EXERCISES)
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          Add exercises that are not in the base list.
        </Text>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <TextInput
            placeholder="Add exercise"
            placeholderTextColor={colors.textMuted}
            value={newAddition}
            onChangeText={(text) => {
              setNewAddition(text);
              setAdditionError(null);
            }}
            style={{
              flex: 1,
              padding: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
            }}
          />
          <Pressable
            onPress={handleAdd}
            style={{
              paddingHorizontal: spacing.md,
              justifyContent: "center",
              borderRadius: radius.md,
              backgroundColor: newAddition.trim()
                && !additionInBase
                && !additionInAdditions
                ? colors.accent
                : colors.surfaceElevated,
            }}
            disabled={
              !newAddition.trim() || Boolean(additionInBase) || Boolean(additionInAdditions)
            }
          >
            <Text
              style={{
                color: newAddition.trim()
                  && !additionInBase
                  && !additionInAdditions
                  ? colors.textOnAccent
                  : colors.textMuted,
                fontWeight: "600",
              }}
            >
              Add
            </Text>
          </Pressable>
        </View>

        {additions.length === 0 ? (
          <Text
            style={{
              marginTop: spacing.sm,
              ...typography.caption,
              color: colors.textMuted,
            }}
          >
            No additions yet.
          </Text>
        ) : (
          additions.map((item) => (
            <View
              key={item}
              style={{
                marginTop: spacing.xs,
                backgroundColor: colors.surfaceElevated,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.md,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.textPrimary }}>{item}</Text>
              <Pressable
                onPress={() =>
                  setCategoryList(
                    "categories",
                    removeFromList(additions, item),
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          ))
        )}
      </Animated.View>

      {/* Removals */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(300)}
        style={{
          marginTop: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.sm,
          }}
        >
          REMOVE FROM BASE (HIDE BUILT-IN)
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          Only base items can be removed. Use the suggestions to avoid typos.
        </Text>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <TextInput
            placeholder="Remove exercise"
            placeholderTextColor={colors.textMuted}
            value={newRemoval}
            onChangeText={(text) => {
              setNewRemoval(text);
              setRemovalError(null);
            }}
            style={{
              flex: 1,
              padding: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
            }}
          />
          <Pressable
            onPress={handleRemove}
            style={{
              paddingHorizontal: spacing.md,
              justifyContent: "center",
              borderRadius: radius.md,
              backgroundColor: newRemoval.trim() && removalExact
                ? colors.error
                : colors.surfaceElevated,
            }}
            disabled={!newRemoval.trim() || !removalExact}
          >
            <Text
              style={{
                color: newRemoval.trim() && removalExact
                  ? colors.onDanger
                  : colors.textMuted,
                fontWeight: "600",
              }}
            >
              Remove
            </Text>
          </Pressable>
        </View>

        {removed.length === 0 ? (
          <Text
            style={{
              marginTop: spacing.sm,
              ...typography.caption,
              color: colors.textMuted,
            }}
          >
            No removals yet.
          </Text>
        ) : (
          removed.map((item) => (
            <View
              key={item}
              style={{
                marginTop: spacing.xs,
                backgroundColor: colors.surfaceElevated,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.md,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.textPrimary }}>{item}</Text>
              <Pressable
                onPress={() =>
                  setCategoryList(
                    "removed",
                    removeFromList(removed, item),
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          ))
        )}
      </Animated.View>

      {/* Bulk JSON Import */}
      <Animated.View
        entering={FadeInUp.delay(220).duration(300)}
        style={{
          marginTop: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.sm,
          }}
        >
          BULK JSON IMPORT
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          Paste a full catalog JSON or a categories map. Changes apply after
          you press Save.
        </Text>
        <TextInput
          placeholder={`Example:\n{\n  "categories": { "Chest": ["Incline Smith Press"] },\n  "removed": { "Chest": ["Decline Barbell Bench Press"] }\n}`}
          placeholderTextColor={colors.textMuted}
          value={bulkJson}
          onChangeText={(text) => {
            setBulkJson(text);
            setBulkError(null);
            setBulkInfo(null);
          }}
          multiline
          style={{
            minHeight: 140,
            padding: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceElevated,
            color: colors.textPrimary,
            textAlignVertical: "top",
          }}
        />

        <Pressable
          onPress={() => setBulkReplace((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: spacing.sm,
          }}
        >
          <Ionicons
            name={bulkReplace ? "checkbox-outline" : "square-outline"}
            size={18}
            color={bulkReplace ? colors.accent : colors.textMuted}
          />
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginLeft: spacing.xs,
            }}
          >
            Replace existing catalog (unchecked = merge)
          </Text>
        </Pressable>

        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            marginTop: spacing.sm,
          }}
        >
          <Pressable
            onPress={applyBulkJson}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.accent,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textOnAccent, fontWeight: "600" }}>
              Apply JSON
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setBulkJson("");
              setBulkError(null);
              setBulkInfo(null);
            }}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceElevated,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
              Clear
            </Text>
          </Pressable>
        </View>

        {bulkError && (
          <Text
            style={{
              marginTop: spacing.xs,
              ...typography.caption,
              color: colors.error,
            }}
          >
            {bulkError}
          </Text>
        )}
        {bulkInfo && !bulkError && (
          <Text
            style={{
              marginTop: spacing.xs,
              ...typography.caption,
              color: colors.textSecondary,
            }}
          >
            {bulkInfo}
          </Text>
        )}
      </Animated.View>

      {/* Base Reference */}
      <Animated.View
        entering={FadeInUp.delay(240).duration(300)}
        style={{
          marginTop: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            ...typography.label,
            color: colors.textMuted,
            marginBottom: spacing.sm,
          }}
        >
          BASE LIST (READ‑ONLY)
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          {baseList.length} exercises
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {baseList.map((item) => (
            <View
              key={item}
              style={{
                paddingVertical: 2,
                paddingHorizontal: spacing.xs,
                borderRadius: radius.sm,
                backgroundColor: colors.surfaceElevated,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Save */}
      <Animated.View
        entering={FadeInUp.delay(280).duration(300)}
        style={{ marginTop: spacing.lg }}
      >
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: colors.accent,
            padding: spacing.md,
            borderRadius: radius.xl,
            alignItems: "center",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={{ color: colors.onAccent, fontWeight: "700", fontSize: 16 }}>
              Save Catalog
            </Text>
          )}
        </Pressable>
        {message && (
          <Text
            style={{
              marginTop: spacing.sm,
              textAlign: "center",
              color: message.includes("Failed")
                ? colors.error
                : colors.success,
            }}
          >
            {message}
          </Text>
        )}
      </Animated.View>
    </ScrollView>
    </SafeAreaView>
  );
}
