import type { Ionicons, MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];
