import { openDatabaseSync } from "expo-sqlite";

export const sqliteDb = openDatabaseSync("gymtracker.db");
