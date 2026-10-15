/** Workouts and body weight as CSV files or a PDF report, handed to the share sheet. */

import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { BodyWeight, Workout, workoutApi, weightApi } from "../services/api";
import { DAY_MS } from "./dates";

export interface ExportStats {
  totalWorkouts: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  uniqueExercises: number;
  workoutDays: number;
  currentStreak: number;
  longestStreak: number;
  averageWorkoutsPerWeek: number;
  weightChange: number | null;
  startWeight: number | null;
  currentWeight: number | null;
}

// CSV export

/**
 * Generate CSV content for workouts
 */
function generateWorkoutsCSV(workouts: Workout[]): string {
  const headers = [
    "Date",
    "Exercise",
    "Category",
    "Set #",
    "Reps",
    "Weight (kg)",
    "Volume",
    "Notes",
  ];
  const rows: string[] = [headers.join(",")];

  // Sort by date (newest first)
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));

  for (const workout of sorted) {
    for (let i = 0; i < workout.sets.length; i++) {
      const set = workout.sets[i];
      const volume = set.reps * set.weight;
      const row = [
        workout.date,
        `"${workout.exercise}"`,
        workout.category || "",
        i + 1,
        set.reps,
        set.weight,
        volume,
        `"${(workout.notes || "").replace(/"/g, '""')}"`,
      ];
      rows.push(row.join(","));
    }
  }

  return rows.join("\n");
}

/**
 * Generate CSV content for body weights
 */
function generateWeightsCSV(weights: BodyWeight[]): string {
  const headers = ["Date", "Weight (kg)", "Change from Previous"];
  const rows: string[] = [headers.join(",")];

  // Sort by date (oldest first for change calculation)
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 0; i < sorted.length; i++) {
    const weight = sorted[i];
    const prevWeight = i > 0 ? sorted[i - 1].weight : null;
    const change =
      prevWeight !== null ? (weight.weight - prevWeight).toFixed(1) : "-";

    const row = [
      weight.date,
      weight.weight,
      change !== "-" ? (parseFloat(change) >= 0 ? `+${change}` : change) : "-",
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Export data to CSV files and share
 */
export async function exportToCSV(
  includeWorkouts: boolean = true,
  includeWeights: boolean = true,
): Promise<void> {
  const [workouts, weights] = await Promise.all([
    workoutApi.listAll(),
    weightApi.listAll(),
  ]);

  const timestamp = new Date().toISOString().split("T")[0];
  const cacheDir = Paths.cache.uri;

  try {
    // If both types have data, create a combined CSV
    const hasWorkouts = includeWorkouts && workouts.length > 0;
    const hasWeights = includeWeights && weights.length > 0;

    if (!hasWorkouts && !hasWeights) {
      throw new Error("No data to export");
    }

    const workoutsCSV = hasWorkouts ? generateWorkoutsCSV(workouts) : "";
    const weightsCSV = hasWeights ? generateWeightsCSV(weights) : "";

    const combined = [
      "=== IRON ARC DATA EXPORT ===",
      `Export Date: ${new Date().toLocaleDateString()}`,
      `Total Workouts: ${workouts.length}`,
      `Total Weight Records: ${weights.length}`,
      "",
      ...(hasWorkouts ? ["=== WORKOUT HISTORY ===", workoutsCSV, "", ""] : []),
      ...(hasWeights ? ["=== BODY WEIGHT HISTORY ===", weightsCSV] : []),
    ].join("\n");

    const filePath = `${cacheDir}iron-arc-export-${timestamp}.csv`;
    const file = new File(filePath);
    await file.write(combined);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: "text/csv",
        dialogTitle: "Export Iron Arc Data",
      });
    } else {
      throw new Error("Sharing is not available on this device");
    }
  } catch (error) {
    console.error("CSV export failed:", error);
    throw error;
  }
}

// PDF export

/**
 * Calculate export statistics
 */
export function calculateExportStats(
  workouts: Workout[],
  weights: BodyWeight[],
): ExportStats {
  const totalSets = workouts.reduce((sum, w) => sum + w.sets.length, 0);
  const totalReps = workouts.reduce(
    (sum, w) => sum + w.sets.reduce((s, set) => s + set.reps, 0),
    0,
  );
  const totalVolume = workouts.reduce(
    (sum, w) => sum + w.sets.reduce((s, set) => s + set.reps * set.weight, 0),
    0,
  );

  const uniqueExercises = new Set(workouts.map((w) => w.exercise)).size;
  const workoutDays = new Set(workouts.map((w) => w.date)).size;

  // Calculate streak
  const sortedDates = [...new Set(workouts.map((w) => w.date))]
    .sort()
    .reverse();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - DAY_MS).toISOString().split("T")[0];

  if (sortedDates[0] === today || sortedDates[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const curr = new Date(sortedDates[i - 1]);
      const prev = new Date(sortedDates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / DAY_MS;
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Longest streak calculation
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const curr = new Date(sortedDates[i - 1]);
      const prev = new Date(sortedDates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / DAY_MS;
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Average workouts per week
  const firstWorkout = sortedDates[sortedDates.length - 1];
  const weeks = firstWorkout
    ? Math.max(
        1,
        (Date.now() - new Date(firstWorkout).getTime()) / (7 * DAY_MS),
      )
    : 1;
  const averageWorkoutsPerWeek = workoutDays / weeks;

  // Weight stats
  const sortedWeights = [...weights].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const startWeight = sortedWeights[0]?.weight || null;
  const currentWeight = sortedWeights[sortedWeights.length - 1]?.weight || null;
  const weightChange =
    startWeight && currentWeight ? currentWeight - startWeight : null;

  return {
    totalWorkouts: workouts.length,
    totalSets,
    totalReps,
    totalVolume,
    uniqueExercises,
    workoutDays,
    currentStreak,
    longestStreak,
    averageWorkoutsPerWeek: Math.round(averageWorkoutsPerWeek * 10) / 10,
    weightChange:
      weightChange !== null ? Math.round(weightChange * 10) / 10 : null,
    startWeight,
    currentWeight,
  };
}

/**
 * Generate HTML for PDF export
 */
function generatePDFHTML(
  workouts: Workout[],
  weights: BodyWeight[],
  stats: ExportStats,
  userName: string,
): string {
  const exportDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Group workouts by date
  const workoutsByDate = workouts.reduce(
    (acc, w) => {
      if (!acc[w.date]) acc[w.date] = [];
      acc[w.date].push(w);
      return acc;
    },
    {} as Record<string, Workout[]>,
  );

  const sortedDates = Object.keys(workoutsByDate).sort().reverse();

  // Generate workout rows HTML
  const workoutRows = sortedDates
    .slice(0, 50)
    .map((date) => {
      const dayWorkouts = workoutsByDate[date];
      const formattedDate = new Date(date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      const escapeHtml = (str: string): string =>
        str.replace(/[&<>"'`]/g, (char) => {
          const map: { [key: string]: string } = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
            "`": "&#96;",
          };
          return map[char] || char;
        });

      return dayWorkouts
        .map((w, idx) => {
          const exercise = escapeHtml(w.exercise);
          const category = w.category ? escapeHtml(w.category) : "-";

          return `
      <tr>
        ${idx === 0 ? `<td rowspan="${dayWorkouts.length}" class="date-cell">${formattedDate}</td>` : ""}
        <td>${exercise}</td>
        <td>${category}</td>
        <td>${w.sets.map((s) => `${s.reps}×${s.weight}kg`).join(", ")}</td>
        <td>${w.sets.reduce((sum, s) => sum + s.reps * s.weight, 0).toLocaleString()} kg</td>
      </tr>
    `;
        })
        .join("");
    })
    .join("");

  // Generate weight rows HTML
  const sortedWeights = [...weights].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const weightRows = sortedWeights
    .slice(0, 30)
    .map((w, idx) => {
      const prevWeight = sortedWeights[idx + 1]?.weight;
      const change = prevWeight ? w.weight - prevWeight : 0;
      const changeClass =
        change > 0 ? "positive" : change < 0 ? "negative" : "";
      const changeText = prevWeight
        ? change >= 0
          ? `+${change.toFixed(1)}`
          : change.toFixed(1)
        : "-";

      return `
      <tr>
        <td>${new Date(w.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
        <td><strong>${w.weight}</strong> kg</td>
        <td class="${changeClass}">${changeText}</td>
      </tr>
    `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          color: #1a1a2e;
          line-height: 1.5;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #22C55E;
        }
        .logo {
          font-size: 32px;
          font-weight: 800;
          color: #22C55E;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #666;
          font-size: 14px;
        }
        .user-info {
          font-size: 16px;
          color: #333;
          margin-top: 12px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 40px;
        }
        .stat-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #22C55E;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 4px;
        }
        
        .section {
          margin-bottom: 40px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e9ecef;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th {
          background: #1a1a2e;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
        }
        td {
          padding: 10px 8px;
          border-bottom: 1px solid #e9ecef;
        }
        tr:nth-child(even) {
          background: #f8f9fa;
        }
        .date-cell {
          font-weight: 600;
          background: #f0fdf4 !important;
          vertical-align: top;
        }
        
        .positive { color: #dc2626; }
        .negative { color: #22C55E; }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
          text-align: center;
          font-size: 11px;
          color: #999;
        }
        
        @media print {
          body { padding: 20px; }
          .stats-grid { grid-template-columns: repeat(4, 1fr); }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">⚡ IRON ARC</div>
        <div class="subtitle">Fitness Progress Report</div>
        <div class="user-info">${userName || "Your"} Fitness Journey</div>
        <div class="subtitle">Generated on ${exportDate}</div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalWorkouts}</div>
          <div class="stat-label">Total Workouts</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalVolume.toLocaleString()}</div>
          <div class="stat-label">Total Volume (kg)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.currentStreak}</div>
          <div class="stat-label">Current Streak</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.weightChange !== null ? (stats.weightChange >= 0 ? "+" : "") + stats.weightChange : "-"}</div>
          <div class="stat-label">Weight Change (kg)</div>
        </div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalSets}</div>
          <div class="stat-label">Total Sets</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalReps.toLocaleString()}</div>
          <div class="stat-label">Total Reps</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.uniqueExercises}</div>
          <div class="stat-label">Unique Exercises</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.averageWorkoutsPerWeek}</div>
          <div class="stat-label">Avg/Week</div>
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">📋 Recent Workouts</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Exercise</th>
              <th>Category</th>
              <th>Sets (Reps × Weight)</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            ${workoutRows || '<tr><td colspan="5" style="text-align:center;color:#999;">No workouts recorded</td></tr>'}
          </tbody>
        </table>
        ${sortedDates.length > 50 ? `<p style="color:#666;font-size:11px;margin-top:8px;">Showing 50 most recent workout sessions. Total: ${sortedDates.length} sessions.</p>` : ""}
      </div>
      
      <div class="section">
        <h2 class="section-title">⚖️ Body Weight History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Weight</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            ${weightRows || '<tr><td colspan="3" style="text-align:center;color:#999;">No weight entries recorded</td></tr>'}
          </tbody>
        </table>
        ${weights.length > 30 ? `<p style="color:#666;font-size:11px;margin-top:8px;">Showing 30 most recent entries. Total: ${weights.length} entries.</p>` : ""}
      </div>
      
      <div class="footer">
        <p>Generated by Iron Arc • Your Personal Fitness Companion</p>
        <p>This report contains your fitness data as of ${exportDate}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Export data to PDF and share
 */
export async function exportToPDF(
  userName: string = "",
): Promise<void> {
  const [workouts, weights] = await Promise.all([
    workoutApi.listAll(),
    weightApi.listAll(),
  ]);

  try {
    const stats = calculateExportStats(workouts, weights);
    const html = generatePDFHTML(workouts, weights, stats, userName);

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Rename file to something meaningful
    const cacheDir = Paths.cache.uri;
    const newUri = `${cacheDir}iron-arc-report-${timestamp}.pdf`;
    const sourceFile = new File(uri);
    await sourceFile.move(new File(newUri));

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(newUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Iron Arc Report",
      });
    } else {
      throw new Error("Sharing is not available on this device");
    }
  } catch (error) {
    console.error("PDF export failed:", error);
    throw error;
  }
}
