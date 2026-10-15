import { useState } from "react";
import { View } from "react-native";
import { useToast } from "../../providers/ToastContext";
import { spacing } from "../../theme/tokens";
import { exportToCSV, exportToPDF } from "../../utils/exportData";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

/** Export all workouts and body weights as CSV or PDF (History header, Profile → Account). */
export function ExportSheet({ visible, onClose, displayName }: { visible: boolean; onClose: () => void; displayName: string }) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const run = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      if (format === "csv") await exportToCSV();
      else await exportToPDF(displayName);
      onClose();
    } catch (e) {
      showToast({ type: "error", message: "Export failed", subtitle: e instanceof Error ? e.message : "Try again in a moment." });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={exporting ? undefined : onClose} title="Export your data" subtitle="All your workouts and body weight entries, to share or keep.">
      <View style={{ gap: spacing.sm }}>
        <Button title="Spreadsheet (CSV)" icon="grid-outline" onPress={() => void run("csv")} loading={exporting === "csv"} disabled={!!exporting} fullWidth />
        <Button title="Report (PDF)" icon="document-text-outline" variant="tonal" onPress={() => void run("pdf")} loading={exporting === "pdf"} disabled={!!exporting} fullWidth />
      </View>
    </Sheet>
  );
}
