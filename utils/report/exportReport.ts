/** The monthly report as a PDF or an Excel workbook, handed to the share sheet. */
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { achievementApi, weightApi, workoutApi } from "../../services/api";
import type { CustomArms } from "../analytics";
import { formatDate } from "../dates";
import type { WeightUnit } from "../unitConversion";
import { buildReport } from "./reportData";
import { reportHtml } from "./reportPdf";
import { reportWorkbook } from "./reportXlsx";

export type ReportFormat = "pdf" | "xlsx";

export interface ReportOptions {
  /** "YYYY-MM" */
  month: string;
  fullName: string;
  weeklyGoal: number | null;
  goalWeightKg: number | null;
  unit: WeightUnit;
  customArms?: CustomArms;
}

/** A4 in points. */
const A4 = { width: 595, height: 842 };
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** A fresh file in the cache (an older one with the same name is replaced). */
function cacheFile(name: string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  return file;
}

export async function exportReport(format: ReportFormat, opts: ReportOptions): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");

  const [workouts, weights, achievements] = await Promise.all([workoutApi.listAll(), weightApi.listAll(), achievementApi.list()]);
  const today = new Date();
  const report = buildReport({
    workouts,
    weights,
    achievements,
    month: opts.month,
    todayKey: formatDate(today),
    firstName: opts.fullName.trim().split(/\s+/)[0] ?? "",
    weeklyGoal: opts.weeklyGoal,
    goalWeightKg: opts.goalWeightKg,
    customArms: opts.customArms,
  });
  const name = `Iron_Arc_Report_${opts.month.replace("-", "_")}`;

  if (format === "pdf") {
    const { uri } = await Print.printToFileAsync({ html: reportHtml(report, opts.unit), ...A4 });
    const file = cacheFile(`${name}.pdf`);
    new File(uri).move(file);
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "Share your report", UTI: "com.adobe.pdf" });
    return;
  }

  const generatedOn = today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const file = cacheFile(`${name}.xlsx`);
  file.create();
  file.write(reportWorkbook(report, { fullName: opts.fullName.trim(), unit: opts.unit, generatedOn }));
  await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, dialogTitle: "Share your spreadsheet", UTI: "org.openxmlformats.spreadsheetml.sheet" });
}
