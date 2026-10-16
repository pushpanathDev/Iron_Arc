import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { TextField } from "../ui/TextField";
import { useCreateExercise } from "../../hooks/useExercises";
import { PICKER_TILES, type CatalogExercise, type TileKey } from "../../data/pickerTiles";
import { ApiError } from "../../services/api";
import { useTheme } from "../../theme/theme";
import { radius, size, spacing, typography } from "../../theme/tokens";

export function CustomExerciseSheet({
  visible,
  initialName,
  tile: initialTile,
  onClose,
  onCreated,
}: {
  visible: boolean;
  initialName: string;
  tile: TileKey;
  onClose: () => void;
  onCreated: (ex: CatalogExercise) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tileKey, setTileKey] = useState<TileKey>(initialTile);
  const create = useCreateExercise();
  const t = PICKER_TILES.find((x) => x.key === tileKey)!;

  const [wasOpen, setWasOpen] = useState(false);
  if (visible && !wasOpen) {
    setWasOpen(true);
    setName(initialName);
    setTileKey(initialTile);
    setError(null);
  } else if (!visible && wasOpen) {
    setWasOpen(false);
  }

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name");
      return;
    }
    try {
      // Arm exercises store their sub-group ("Biceps") so they land on the right tile; workouts save "Arms".
      await create.mutateAsync({ category: t.subgroup ?? t.category, name: trimmed });
      onCreated({ name: trimmed, category: t.category, subgroup: t.subgroup, tile: t.key, custom: true });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? `You already have this exercise in ${t.label}` : "Couldn't save. Check your connection and try again.");
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Custom exercise" subtitle={`Saved to your ${t.label} list`}>
      <View style={{ gap: spacing.md }}>
        <TextField
          label="Exercise name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          error={error}
          autoFocus
          maxLength={100}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {PICKER_TILES.map((x) => (
            <CategoryChip key={x.key} label={x.label} active={x.key === tileKey} onPress={() => setTileKey(x.key)} />
          ))}
        </View>
        <Button title="Save exercise" onPress={save} loading={create.isPending} fullWidth />
      </View>
    </Sheet>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        minHeight: size.control,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        justifyContent: "center",
        backgroundColor: active ? colors.surfaceContainerHigh : colors.raised,
      }}
    >
      <Text style={[typography.labelLg, { color: active ? colors.accent : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}
