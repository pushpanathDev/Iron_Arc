import { ReactElement } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../src/theme/theme";

export type StatChipProps = {
  label: string;
  value: number;
  suffix?: string;
  icon?: ReactElement;
};

export default function StatChip({
  label,
  value,
  suffix,
  icon,
}: StatChipProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      {icon && icon}

      <View>
        <Text
          style={{
            fontSize: 11,
            color: colors.textSecondary,
            lineHeight: 14,
          }}
        >
          {label}
        </Text>

        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: colors.textPrimary,
            lineHeight: 18,
          }}
        >
          {`${value}${suffix ? ` ${suffix}` : ""}`}
        </Text>
      </View>
    </View>
  );
}
