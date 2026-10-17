/*
 * The monthly report as an Excel workbook: Summary (cards, weekly table and
 * chart, records), Workouts (one row per set, records highlighted), Body
 * weight and Achievements.
 */
import { displayWeight, weightLabel, type WeightUnit } from "../unitConversion";
import type { ReportData } from "./reportData";
import { buildXlsx, ref, type Cell, type CellStyle, type Sheet } from "./xlsx";

const GREEN = "2E7D57";
const GREEN_DARK = "1E6B47";
const GREEN_SOFT = "E8F4EE";
const CARD = "F3F5F7";
const LINE = "DDE2E7";
const MUTED = "5B6672";
const TEXT = "1F2328";
const RECORD = "B26A00";
const RECORD_SOFT = "FFF4DC";
const RED = "C62828";

const HEADER: CellStyle = { bold: true, color: "FFFFFF", fill: GREEN, valign: "center" };
const TOTAL: CellStyle = { bold: true, fill: CARD };

const shortDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
};
const round1 = (n: number) => Math.round(n * 10) / 10;

export function reportWorkbook(report: ReportData, opts: { fullName: string; unit: WeightUnit; generatedOn: string }): Uint8Array {
  const { unit } = opts;
  const u = weightLabel(unit);
  const w = (kg: number) => round1(displayWeight(kg, unit));
  const vol = (kg: number) => Math.round(displayWeight(kg, unit));
  return buildXlsx([summarySheet(report, opts, u, w, vol), workoutsSheet(report, u, w, vol), bodySheet(report, u, w), badgesSheet(report)], {
    title: `Iron Arc progress report, ${report.monthName}`,
    createdAt: new Date(),
  });
}

// ── Summary ──────────────────────────────────────────────────────────────────

function summarySheet(r: ReportData, opts: { fullName: string; generatedOn: string }, u: string, w: (kg: number) => number, vol: (kg: number) => number): Sheet {
  const rows: (Cell | null)[][] = [];
  const merges: string[] = [];
  const set = (row: number, col: number, cell: Cell) => ((rows[row] ??= [])[col] = cell);
  /** A merged block with the same style in every cell, so fills and borders cover it all. */
  const block = (row: number, from: number, to: number, cell: Cell) => {
    for (let c = from; c <= to; c++) set(row, c, c === from ? cell : { v: null, s: cell.s });
    if (to > from) merges.push(`${ref(from, row)}:${ref(to, row)}`);
  };

  // Title band.
  const band: CellStyle = { fill: GREEN_DARK, color: "FFFFFF", valign: "center" };
  block(0, 0, 9, { v: `Iron Arc progress report${opts.fullName ? ` · ${opts.fullName}` : ""}`, s: { ...band, bold: true, size: 18 } });
  block(1, 0, 9, { v: `${r.rangeLabel}  ·  Generated on ${opts.generatedOn}`, s: { ...band, size: 10, color: "CFEBDD" } });

  // Cards: label, value, note.
  const cards: { cols: [number, number]; label: string; value: number | string; numFmt?: string; note: string; noteColor?: string }[] = [
    {
      cols: [0, 1],
      label: "WORKOUTS",
      value: r.workouts,
      note: r.workoutsVsLastMonth == null ? "Sessions logged" : `${r.workoutsVsLastMonth >= 0 ? "+" : "−"}${Math.abs(r.workoutsVsLastMonth)} vs last month`,
      noteColor: r.workoutsVsLastMonth != null && r.workoutsVsLastMonth > 0 ? GREEN : undefined,
    },
    { cols: [2, 3], label: "DAYS TRAINED", value: r.daysTrained, note: `of ${r.daysSoFar} days${r.isCurrentMonth ? " so far" : ""}` },
    { cols: [4, 6], label: `VOLUME LIFTED (${u.toUpperCase()})`, value: vol(r.volumeKg), numFmt: "#,##0", note: r.bestVolumeMonth ? "Your best month yet" : "Total weight lifted", noteColor: r.bestVolumeMonth ? GREEN : undefined },
    { cols: [7, 9], label: "LONGEST RUN", value: `${r.longestRun} ${r.longestRun === 1 ? "day" : "days"}`, note: r.runOngoing ? "Still going" : "Days in a row", noteColor: r.runOngoing ? RECORD : undefined },
  ];
  for (const c of cards) {
    const edge = { fill: CARD, border: LINE };
    block(3, c.cols[0], c.cols[1], { v: c.label, s: { ...edge, bold: true, size: 9, color: MUTED } });
    block(4, c.cols[0], c.cols[1], { v: c.value, s: { ...edge, bold: true, size: 20, color: TEXT, align: "left", numFmt: c.numFmt } });
    block(5, c.cols[0], c.cols[1], { v: c.note, s: { ...edge, size: 9, color: c.noteColor ?? MUTED } });
  }

  // Weekly breakdown.
  set(7, 0, { v: "Weekly breakdown", s: { bold: true, size: 13, color: TEXT } });
  ["Week", "Dates", "Workouts", `Volume (${u})`, "Status"].forEach((h, i) => set(8, i, { v: h, s: { ...HEADER, align: i >= 2 && i <= 3 ? "right" : "left" } }));
  const first = 9;
  r.weeks.forEach((wk, i) => {
    const row = first + i;
    const status = `${wk.metTarget == null ? "" : wk.metTarget ? "Target met" : "Below target"}${wk.best ? `${wk.metTarget == null ? "" : " · "}★ Best week` : ""}` || "—";
    const tone: CellStyle = wk.metTarget ? { fill: GREEN_SOFT, color: GREEN_DARK } : { color: MUTED };
    const line: CellStyle = { borderBottom: LINE };
    set(row, 0, { v: wk.label, s: { ...line, bold: wk.best } });
    set(row, 1, { v: `${shortDate(wk.start)} – ${shortDate(wk.end)}`, s: { ...line, color: MUTED } });
    set(row, 2, { v: wk.workouts, s: { ...line, bold: wk.best } });
    set(row, 3, { v: vol(wk.volumeKg), s: { ...line, numFmt: "#,##0" } });
    set(row, 4, { v: status, s: { ...line, ...tone, bold: wk.best } });
  });
  const last = first + r.weeks.length - 1;
  const totalRow = last + 1;
  set(totalRow, 0, { v: "Total", s: TOTAL });
  set(totalRow, 1, { v: `${r.weeks.length} ${r.weeks.length === 1 ? "week" : "weeks"}`, s: { ...TOTAL, color: MUTED } });
  set(totalRow, 2, { v: r.weeks.reduce((n, x) => n + x.workouts, 0), f: `SUM(C${first + 1}:C${last + 1})`, s: TOTAL });
  set(totalRow, 3, { v: r.weeks.reduce((n, x) => n + vol(x.volumeKg), 0), f: `SUM(D${first + 1}:D${last + 1})`, s: { ...TOTAL, numFmt: "#,##0" } });
  set(totalRow, 4, { v: r.weeklyGoal ? `${r.weeksMet} of ${r.weeks.length} weeks on target` : "No weekly goal set", s: TOTAL });

  // Records.
  let row = totalRow + 2;
  set(row, 0, { v: `Personal records this month: ${r.prs.length}`, s: { bold: true, size: 13, color: TEXT } });
  row += 1;
  if (r.prs.length === 0) set(row++, 0, { v: "No new records this month.", s: { color: MUTED, italic: true } });
  for (const pr of r.prs) {
    const s: CellStyle = { fill: RECORD_SOFT, borderBottom: "F2D9A6" };
    block(row, 0, 2, { v: `★ ${pr.exercise}`, s: { ...s, bold: true, color: TEXT } });
    set(row, 3, { v: `${w(pr.weightKg)} ${u} × ${pr.reps}`, s: { ...s, color: RECORD, bold: true } });
    set(row, 4, { v: null, date: pr.date, s: { ...s, color: MUTED } });
    row += 1;
  }

  // Coach line.
  row += 1;
  block(row, 0, 9, { v: r.insight, s: { fill: GREEN_SOFT, color: GREEN_DARK, bold: true, valign: "center" } });

  const heights: Record<number, number> = { 0: 34, 1: 20, 2: 8, 3: 18, 4: 34, 5: 18, 6: 10, 7: 22, 8: 20, [row]: 26 };
  return {
    name: "Summary",
    rows,
    widths: [14, 16, 13, 14, 26, 3, 13, 13, 13, 13],
    heights,
    merges,
    gridLines: false,
    tabColor: GREEN,
    chart:
      r.weeks.length > 0
        ? {
            title: "Workouts vs weekly target",
            categories: `A${first + 1}:A${last + 1}`,
            series: [
              { name: "Workouts", values: `C${first + 1}:C${last + 1}`, color: GREEN, type: "bar" },
              ...(r.weeklyGoal ? [{ name: `Target (${r.weeklyGoal} a week)`, values: r.weeks.map(() => r.weeklyGoal!), color: "8A939C", type: "line" as const, dashed: true }] : []),
            ],
            from: { col: 6, row: 7 },
            to: { col: 10, row: Math.max(totalRow + 1, 21) },
          }
        : undefined,
  };
}

// ── Workouts ─────────────────────────────────────────────────────────────────

function workoutsSheet(r: ReportData, u: string, w: (kg: number) => number, vol: (kg: number) => number): Sheet {
  const headers = ["Date", "Category", "Exercise", "Set", "Reps", `Weight (${u})`, `Volume (${u})`, "Notes", "Record"];
  const rows: (Cell | null)[][] = [headers.map((h, i) => ({ v: h, s: { ...HEADER, align: i >= 3 && i <= 6 ? "right" : "left" } }))];
  if (r.setRows.length === 0) {
    rows.push([{ v: `No workouts logged in ${r.monthName}.`, s: { color: MUTED, italic: true } }]);
    return { name: "Workouts", rows, widths: [13, 12, 30, 6, 7, 12, 14, 28, 12], freezeRows: 1, tabColor: GREEN, heights: { 0: 22 } };
  }
  for (const s of r.setRows) {
    const base: CellStyle = s.pr ? { fill: RECORD_SOFT, bold: true } : {};
    rows.push([
      { v: null, date: s.date, s: base },
      { v: s.category, s: base },
      { v: s.exercise, s: base },
      { v: s.set, s: base },
      { v: s.reps, s: base },
      { v: s.weightKg > 0 ? w(s.weightKg) : null, s: { ...base, numFmt: "0.0" } },
      { v: s.weightKg > 0 ? vol(s.weightKg * s.reps) : null, s: { ...base, numFmt: "#,##0" } },
      { v: s.notes, s: { ...base, color: MUTED, bold: false } },
      { v: s.pr ? "★ New PR" : null, s: s.pr ? { ...base, color: RECORD } : undefined },
    ]);
  }
  const lastData = rows.length; // 1-based row of the last set
  const records = r.setRows.filter((s) => s.pr).length;
  rows.push([]);
  // Totals follow the filter (SUBTOTAL skips hidden rows) and sit outside it.
  rows.push([
    { v: "Total", s: TOTAL },
    { v: null, s: TOTAL },
    { v: null, s: TOTAL },
    { v: r.setRows.length, f: `SUBTOTAL(103,D2:D${lastData})`, s: TOTAL },
    { v: r.totalReps, f: `SUBTOTAL(109,E2:E${lastData})`, s: TOTAL },
    { v: null, s: TOTAL },
    { v: r.setRows.reduce((n, s) => n + (s.weightKg > 0 ? vol(s.weightKg * s.reps) : 0), 0), f: `SUBTOTAL(109,G2:G${lastData})`, s: { ...TOTAL, numFmt: "#,##0" } },
    { v: "Sets, reps and volume of the rows shown", s: { ...TOTAL, color: MUTED, bold: false, italic: true } },
    { v: records ? `${records} ${records === 1 ? "record" : "records"}` : null, s: { ...TOTAL, color: RECORD } },
  ]);
  return {
    name: "Workouts",
    rows,
    widths: [13, 12, 30, 6, 7, 12, 14, 34, 12],
    heights: { 0: 22 },
    freezeRows: 1,
    filter: `A1:I${lastData}`,
    dataBars: [{ range: `G2:G${lastData}`, color: "8FD1AE" }],
    tabColor: GREEN,
  };
}

// ── Body weight ──────────────────────────────────────────────────────────────

function bodySheet(r: ReportData, u: string, w: (kg: number) => number): Sheet {
  const rows: (Cell | null)[][] = [["Date", `Weight (${u})`, "Change"].map((h, i) => ({ v: h, s: { ...HEADER, align: i ? "right" : "left" } }))];
  if (r.weightRows.length === 0) rows.push([{ v: `No weigh-ins in ${r.monthName}.`, s: { color: MUTED, italic: true } }]);
  r.weightRows.forEach((entry, i) => {
    const change = i === 0 ? null : round1(w(entry.kg) - w(r.weightRows[i - 1].kg));
    rows.push([
      { v: null, date: entry.date },
      { v: w(entry.kg), s: { numFmt: "0.0" } },
      { v: change, s: { numFmt: "+0.0;-0.0;0.0", color: MUTED } },
    ]);
  });
  if (r.body) {
    const tone = r.body.towardGoal == null ? MUTED : r.body.towardGoal ? GREEN : RED;
    rows.push([]);
    rows.push([{ v: "Start", s: { bold: true } }, { v: w(r.body.startKg), s: { numFmt: "0.0" } }]);
    rows.push([{ v: "Latest", s: { bold: true } }, { v: w(r.body.latestKg), s: { numFmt: "0.0" } }]);
    rows.push([{ v: "Change", s: { bold: true } }, { v: round1(w(r.body.latestKg) - w(r.body.startKg)), s: { numFmt: "+0.0;-0.0;0.0", bold: true, color: tone } }]);
  }
  return { name: "Body weight", rows, widths: [14, 14, 12], heights: { 0: 22 }, freezeRows: 1, tabColor: GREEN };
}

// ── Achievements ─────────────────────────────────────────────────────────────

function badgesSheet(r: ReportData): Sheet {
  const tierColor = { bronze: "8A4B22", silver: "5B6672", gold: RECORD } as const;
  const rows: (Cell | null)[][] = [["Badge", "Tier", "Status", "Progress", "Target", "Unlocked"].map((h, i) => ({ v: h, s: { ...HEADER, align: i === 3 || i === 4 ? "right" : "left" } }))];
  for (const b of r.badgeRows) {
    const unlocked = !!b.unlockedAt;
    const thisMonth = unlocked && b.unlockedAt! >= r.start && b.unlockedAt! <= r.end;
    const base: CellStyle = thisMonth ? { fill: GREEN_SOFT } : {};
    rows.push([
      { v: b.title, s: { ...base, bold: unlocked } },
      { v: b.tier[0].toUpperCase() + b.tier.slice(1), s: { ...base, color: tierColor[b.tier] } },
      { v: unlocked ? (thisMonth ? "Unlocked this month" : "Unlocked") : b.progress > 0 ? "In progress" : "Not started", s: { ...base, color: unlocked ? GREEN_DARK : MUTED } },
      { v: b.progress, s: { ...base, numFmt: "#,##0" } },
      { v: b.target, s: { ...base, numFmt: "#,##0" } },
      b.unlockedAt ? { v: null, date: b.unlockedAt, s: base } : { v: null, s: base },
    ]);
  }
  return { name: "Achievements", rows, widths: [28, 9, 20, 11, 11, 14], heights: { 0: 22 }, freezeRows: 1, tabColor: GREEN };
}
