import { useEffect } from "react";
import { promptBatteryOptimizationDisableOnce } from "../notifications/notificationService";

export function BatteryOptimizationPrompt() {
  useEffect(() => {
    promptBatteryOptimizationDisableOnce().catch((error) => {
      console.warn("Battery optimization prompt failed:", error);
    });
  }, []);

  return null;
}
