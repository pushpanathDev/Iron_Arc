/*
 * The monthly report as print-ready HTML: three A4 pages. Page 1 is dark like
 * the app; pages 2 and 3 are light so they read and print well. Charts are
 * inline SVG, so the report needs no network.
 */
import { displayWeight, weightLabel, type WeightUnit } from "../unitConversion";
import { weekdayIndex, type ReportData } from "./reportData";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayMonth = (key: string) => `${Number(key.slice(8, 10))} ${SHORT_MONTHS[Number(key.slice(5, 7)) - 1]}`;
const num = (n: number) => Math.round(n).toLocaleString("en-US");
/** A weight in the user's unit: "52.5", "80". */
const weight = (kg: number, unit: WeightUnit) => (Math.round(displayWeight(kg, unit) * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });

/** User text (names, exercises, notes) is escaped before it goes in the page. */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 11px; }
.page { width: 210mm; height: 296mm; padding: 13mm 14mm 11mm; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; }
.page:last-child { page-break-after: auto; }
.cond { font-family: "sans-serif-condensed", "Roboto Condensed", "Arial Narrow", sans-serif; font-weight: 700; letter-spacing: 0.02em; }
.top { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.brand { font-size: 15px; letter-spacing: 0.12em; }
.kicker { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); text-align: right; }
.range { font-size: 12px; font-weight: 600; text-align: right; margin-top: 2px; }
h1 { font-size: 36px; line-height: 1.05; text-transform: uppercase; margin-top: 22px; }
h2 { font-size: 28px; line-height: 1.1; text-transform: uppercase; margin-top: 20px; }
.sub { color: var(--muted); font-size: 12px; margin-top: 6px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
.label { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
.title { font-size: 14px; text-transform: uppercase; }
.row { display: flex; gap: 10px; }
.grow { flex: 1; min-width: 0; }
.foot { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; color: var(--muted); font-size: 9px; }
.muted { color: var(--muted); }

.dark { --bg: #111417; --card: #191C1F; --line: #2A2F34; --text: #E1E2E7; --muted: #8A939C; --accent: #22D47F; background: var(--bg); color: var(--text); }
.light { --bg: #FFFFFF; --card: #F4F6F8; --line: #E3E7EB; --text: #16191D; --muted: #5B6672; --accent: #1E6B47; background: var(--bg); color: var(--text); }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 20px; }
.stat .value { font-size: 34px; line-height: 1; margin-top: 10px; }
.stat .unit { font-size: 13px; color: var(--muted); margin-left: 3px; }
.stat .note { font-size: 10px; margin-top: 8px; color: var(--muted); }
.good { color: #3EE08F; }
.light .good { color: #1E6B47; }
.bad { color: #C62828; }
.streak { color: #FFB957; }
.record { color: #F5A524; }

.prs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
.pr { background: #231C10; border: 1px solid #4A3A18; border-radius: 10px; padding: 10px 12px; }
.pr .name { font-size: 10px; color: #C9CED4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pr .lift { font-size: 15px; color: #F5A524; margin-top: 4px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #F5A524; margin-right: 6px; vertical-align: middle; }

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
.bar { height: 7px; border-radius: 4px; background: #E3E7EB; margin-top: 4px; overflow: hidden; }
.bar > div { height: 100%; background: #2E7D57; border-radius: 4px; }
.mrow { margin-top: 10px; }
.mrow .head { display: flex; justify-content: space-between; font-size: 10.5px; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
th { text-align: left; font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); font-weight: 600; padding: 0 4px 6px 0; }
td { padding: 7px 4px 7px 0; border-top: 1px solid var(--line); vertical-align: top; }
td.n, th.n { text-align: right; white-space: nowrap; }

.cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-top: 10px; }
.cal .wd { text-align: center; font-size: 8.5px; color: var(--muted); font-weight: 600; }
.cal .d { height: 30px; border-radius: 6px; background: #EDF0F3; color: #8A939C; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; position: relative; }
.cal .d.on { background: #2E7D57; color: #FFFFFF; }
.cal .d.future { background: transparent; border: 1px dashed #D5DAE0; color: #B5BCC4; }
.cal .d.today { outline: 2px solid #16191D; outline-offset: 1px; }
.cal .d .pr { position: absolute; top: 3px; right: 3px; width: 6px; height: 6px; padding: 0; border: 0; border-radius: 50%; background: #F5A524; }
.legend { display: flex; gap: 14px; margin-top: 10px; font-size: 9px; color: var(--muted); align-items: center; }
.sw { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }

.bstats { display: flex; gap: 28px; margin-top: 10px; }
.bstats .v { font-size: 24px; margin-top: 4px; }
.pill { font-size: 9px; padding: 4px 9px; border-radius: 999px; border: 1px solid #BFE0CF; color: #1E6B47; background: #E8F4EE; }
.badges { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
.badge { display: flex; gap: 8px; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 9px; }
.medal { width: 26px; height: 26px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 12px; font-weight: 700; }
.badge .t { font-size: 10px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge .s { font-size: 8.5px; color: var(--muted); margin-top: 2px; }
.next { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.insight { margin-top: 14px; background: #2E7D57; color: #FFFFFF; border-radius: 12px; padding: 16px 18px; }
.insight .label { color: #CFEBDD; }
.insight .say { font-size: 18px; margin-top: 6px; }
.empty { color: var(--muted); font-size: 11px; padding: 18px 0 6px; }
`;

const TIER = { bronze: "#A0623A", silver: "#7D8893", gold: "#C8901A" } as const;

function header(r: ReportData) {
  return `<div class="top"><div class="cond brand">IRON ARC</div><div><div class="kicker">Monthly report</div><div class="range">${esc(r.rangeLabel)}</div></div></div>`;
}

const footer = (page: number) => `<div class="foot"><span>Iron Arc · Monthly report</span><span>Page ${page} of 3</span></div>`;

/** Workouts per week: bars, the weekly target as a dashed line, the best week marked. */
function weeksChart(r: ReportData): string {
  const W = 640;
  const H = 230;
  const top = 34;
  const base = H - 26;
  const max = Math.max(1, r.weeklyGoal ?? 0, ...r.weeks.map((w) => w.workouts));
  const slot = W / Math.max(1, r.weeks.length);
  const barW = Math.min(110, slot * 0.62);
  const y = (v: number) => base - ((base - top) * v) / max;
  const bars = r.weeks
    .map((w, i) => {
      const x = slot * i + (slot - barW) / 2;
      const h = base - y(w.workouts);
      const fill = w.best ? "#22D47F" : "#1C8F5A";
      const flag = w.best ? `<rect x="${x + barW / 2 - 34}" y="${y(w.workouts) - 34}" width="68" height="16" rx="8" fill="#22D47F"/><text x="${x + barW / 2}" y="${y(w.workouts) - 23}" font-size="8.5" font-weight="700" fill="#00240F" text-anchor="middle" letter-spacing="0.8">BEST WEEK</text>` : "";
      return (
        `<rect x="${x}" y="${y(w.workouts)}" width="${barW}" height="${Math.max(h, 1)}" rx="5" fill="${fill}"/>` +
        `<text x="${x + barW / 2}" y="${y(w.workouts) - 6}" font-size="11" font-weight="700" fill="#E1E2E7" text-anchor="middle">${w.workouts}</text>` +
        flag +
        `<text x="${x + barW / 2}" y="${H - 8}" font-size="10" fill="${w.best ? "#E1E2E7" : "#8A939C"}" font-weight="${w.best ? 700 : 400}" text-anchor="middle">${w.label}</text>`
      );
    })
    .join("");
  const target = r.weeklyGoal
    ? `<line x1="0" x2="${W}" y1="${y(r.weeklyGoal)}" y2="${y(r.weeklyGoal)}" stroke="#8A939C" stroke-dasharray="5 4" stroke-width="1"/><text x="0" y="${y(r.weeklyGoal) - 5}" font-size="9" fill="#8A939C">Target ${r.weeklyGoal}</text>`
    : "";
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${target}${bars}<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="#2A2F34"/></svg>`;
}

/** A line with a soft area under it, labelled at each point (weekly volume, body weight). */
function lineChart(points: { label: string; value: number; tag?: string }[], opts: { width: number; height: number; color: string; fill: string; format: (v: number) => string; everyLabel?: number }): string {
  const { width: W, height: H } = opts;
  if (points.length === 0) return "";
  const pad = 22;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : pad + ((W - pad * 2) * i) / (points.length - 1));
  const y = (v: number) => H - 30 - ((H - 58) * (v - min)) / span;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - 30} L${x(0).toFixed(1)},${H - 30} Z`;
  const step = opts.everyLabel ?? 1;
  const marks = points
    .map((p, i) => {
      const last = i === points.length - 1;
      const show = last || i === 0 || i % step === 0;
      return (
        `<circle cx="${x(i)}" cy="${y(p.value)}" r="${last ? 4 : 2.5}" fill="${last ? opts.color : "#FFFFFF"}" stroke="${opts.color}" stroke-width="1.5"/>` +
        (show ? `<text x="${x(i)}" y="${y(p.value) - 9}" font-size="8.5" fill="#5B6672" text-anchor="middle" font-weight="${last ? 700 : 400}">${opts.format(p.value)}</text>` : "") +
        (show ? `<text x="${x(i)}" y="${H - 12}" font-size="8.5" fill="#8A939C" text-anchor="middle">${esc(p.label)}</text>` : "")
      );
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><path d="${area}" fill="${opts.fill}"/><path d="${path}" fill="none" stroke="${opts.color}" stroke-width="2"/>${marks}</svg>`;
}

// ── Pages ────────────────────────────────────────────────────────────────────

/** Best week, heaviest lift and most-trained group, when the month has them. */
function highlights(r: ReportData, unit: WeightUnit): string {
  const best = r.weeks.find((w) => w.best);
  const tiles = [
    best ? ["Best week", best.label, `${best.workouts} workouts`] : null,
    r.heaviest ? ["Heaviest lift", `${weight(r.heaviest.weightKg, unit)} ${weightLabel(unit)} × ${r.heaviest.reps}`, r.heaviest.exercise] : null,
    r.muscles[0] ? ["Most trained", r.muscles[0].group, `${r.muscles[0].sets} sets`] : null,
  ].filter((t): t is string[] => !!t);
  if (!tiles.length) return "";
  return `<div class="stats" style="grid-template-columns:repeat(${tiles.length},1fr);margin-top:14px">${tiles
    .map(([label, value, note]) => `<div class="card"><div class="label">${label}</div><div class="cond" style="font-size:20px;margin-top:8px">${esc(value)}</div><div class="note muted" style="font-size:10px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(note)}</div></div>`)
    .join("")}</div>`;
}

function coverPage(r: ReportData, unit: WeightUnit): string {
  const u = weightLabel(unit);
  const delta = r.workoutsVsLastMonth;
  const stat = (label: string, value: string, note: string, noteClass = "", unitText = "") =>
    `<div class="card stat"><div class="label">${label}</div><div class="value cond">${value}${unitText ? `<span class="unit">${unitText}</span>` : ""}</div><div class="note ${noteClass}">${note}</div></div>`;
  const prTiles = r.prs.slice(0, 6).map((p) => `<div class="pr"><div class="name">${esc(p.exercise)}</div><div class="lift cond">${weight(p.weightKg, unit)} ${u} × ${p.reps}</div></div>`).join("");
  const more = r.prs.length > 6 ? `<div class="sub">and ${r.prs.length - 6} more in the spreadsheet</div>` : "";

  return `<section class="page dark">
    ${header(r)}
    <h1 class="cond">${esc(r.headline)}</h1>
    <div class="sub">${esc(r.subline)}</div>
    <div class="stats">
      ${stat("Workouts", String(r.workouts), delta == null ? "Sessions logged" : `${delta >= 0 ? "+" : "−"}${Math.abs(delta)} vs last month`, delta != null && delta > 0 ? "good" : "")}
      ${stat("Days trained", String(r.daysTrained), `of ${r.daysSoFar} days${r.isCurrentMonth ? " so far" : ""}`)}
      ${stat("Volume lifted", num(displayWeight(r.volumeKg, unit)), r.bestVolumeMonth ? "Your best month yet" : "Total weight lifted", r.bestVolumeMonth ? "good" : "", u)}
      ${stat("Longest run", String(r.longestRun), r.runOngoing ? "Still going" : "Days in a row", r.runOngoing ? "streak" : "", r.longestRun === 1 ? "day" : "days")}
    </div>
    <div class="card" style="margin-top:14px">
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <div><div class="title cond">Workouts per week</div><div class="sub" style="margin-top:3px;font-size:10px">${r.weeklyGoal ? `Target: ${r.weeklyGoal} a week · ${r.weeksMet} of ${r.weeks.length} weeks on target` : "Set a weekly goal in your profile to see a target"}</div></div>
      </div>
      <div style="margin-top:14px">${r.weeks.length ? weeksChart(r) : `<div class="empty">No weeks yet.</div>`}</div>
    </div>
    ${highlights(r, unit)}
    <div class="card" style="margin-top:14px">
      <div class="title cond"><span class="dot"></span>Personal records this month: ${r.prs.length}</div>
      ${r.prs.length ? `<div class="prs">${prTiles}</div>${more}` : `<div class="empty">No new records this month. Keep adding a little weight or a rep.</div>`}
    </div>
    ${footer(1)}
  </section>`;
}

function recordsTable(r: ReportData, unit: WeightUnit): string {
  if (!r.prs.length) return "";
  const u = weightLabel(unit);
  const shown = r.prs.slice(0, 10);
  const rows = shown
    .map((p) => `<tr><td><b>${esc(p.exercise)}</b></td><td>${dayMonth(p.date)}</td><td class="n" style="color:#B26A00"><b>${weight(p.weightKg, unit)} ${u} × ${p.reps}</b></td><td class="n muted">${weight(p.previousKg, unit)} ${u} × ${p.previousReps}</td></tr>`)
    .join("");
  const more = r.prs.length > shown.length ? `<div class="muted" style="font-size:9.5px;margin-top:6px">and ${r.prs.length - shown.length} more in the spreadsheet</div>` : "";
  return `<div class="card" style="margin-top:12px"><div class="title cond"><span class="dot"></span>Records this month</div><table><tr><th>Exercise</th><th>Date</th><th class="n">New best</th><th class="n">Before</th></tr>${rows}</table>${more}</div>`;
}

function trainingPage(r: ReportData, unit: WeightUnit): string {
  const u = weightLabel(unit);
  const maxSets = Math.max(1, ...r.muscles.map((m) => m.sets));
  const muscles = r.muscles.length
    ? r.muscles
        .slice(0, 8)
        .map((m) => `<div class="mrow"><div class="head"><b>${esc(m.group)}</b><span class="muted">${m.sets} ${m.sets === 1 ? "set" : "sets"}</span></div><div class="bar"><div style="width:${Math.round((m.sets / maxSets) * 100)}%"></div></div></div>`)
        .join("")
    : `<div class="empty">No sets logged this month.</div>`;

  const exercises = r.topExercises.length
    ? `<table><tr><th>Exercise</th><th class="n">Sets</th><th class="n">Top set</th><th class="n">Volume</th></tr>${r.topExercises
        .map(
          (e, i) =>
            `<tr><td><span class="muted">${i + 1}.</span> <b>${esc(e.name)}</b></td><td class="n">${e.sets}</td><td class="n">${e.topWeightKg > 0 ? `${weight(e.topWeightKg, unit)} ${u} × ${e.topReps}` : `${e.topReps} reps`}</td><td class="n"><b>${num(displayWeight(e.volumeKg, unit))}</b></td></tr>`,
        )
        .join("")}</table><div class="row muted" style="justify-content:space-between;margin-top:8px;font-size:9.5px"><span>Total volume: ${num(displayWeight(r.volumeKg, unit))} ${u}</span><span>${r.totalSets} sets</span></div>`
    : `<div class="empty">No exercises logged this month.</div>`;

  const trend = r.weeks.length
    ? lineChart(
        r.weeks.map((w) => ({ label: w.label.replace("Week ", "W"), value: Math.round(displayWeight(w.volumeKg, unit)) })),
        { width: 320, height: 150, color: "#2E7D57", fill: "rgba(46,125,87,0.12)", format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) },
      )
    : "";
  const pct = r.volumeVsLastMonthPct;
  const trendNote = pct == null ? "First month to compare." : pct >= 0 ? `<span class="good">Up ${pct}% on last month.</span>` : `<span class="muted">Down ${Math.abs(pct)}% on last month.</span>`;

  const lead = weekdayIndex(r.start);
  const days =
    ["M", "T", "W", "T", "F", "S", "S"].map((d) => `<div class="wd">${d}</div>`).join("") +
    Array.from({ length: lead }, () => "<div></div>").join("") +
    r.calendar
      .map((d) => {
        const cls = ["d", d.trained ? "on" : "", d.future ? "future" : "", r.isCurrentMonth && d.date === r.end ? "today" : ""].filter(Boolean).join(" ");
        return `<div class="${cls}">${Number(d.date.slice(8, 10))}${d.pr ? '<span class="pr"></span>' : ""}</div>`;
      })
      .join("");
  const rest = r.calendar.filter((d) => !d.future && !d.trained).length;

  return `<section class="page light">
    ${header(r)}
    <h2 class="cond">Your training</h2>
    <div class="sub">What you trained, your top lifts and how steady the month was.</div>
    <div class="grid2">
      <div class="card"><div class="row" style="justify-content:space-between"><div class="title cond">Muscle groups</div><div class="muted" style="font-size:9.5px">${r.totalSets} sets</div></div>${muscles}</div>
      <div class="card"><div class="row" style="justify-content:space-between"><div class="title cond">Top exercises</div><div class="muted" style="font-size:9.5px">By volume (${u})</div></div>${exercises}</div>
      <div class="card"><div class="row" style="justify-content:space-between"><div class="title cond">Volume by week</div><div class="cond" style="color:#1E6B47">${num(displayWeight(r.volumeKg, unit))} ${u}</div></div><div style="margin-top:10px">${trend || '<div class="empty">No volume yet.</div>'}</div><div style="font-size:10px;margin-top:6px">${trendNote}</div></div>
      <div class="card"><div class="row" style="justify-content:space-between"><div class="title cond">Consistency</div><div style="font-size:9.5px" class="${r.runOngoing ? "record" : "muted"}">Longest run: ${r.longestRun} ${r.longestRun === 1 ? "day" : "days"}</div></div><div class="cal">${days}</div>
        <div class="legend"><span><span class="sw" style="background:#2E7D57"></span>Trained (${r.daysTrained})</span><span><span class="sw" style="background:#EDF0F3"></span>Rest (${rest})</span><span><span class="dot" style="width:6px;height:6px;margin-right:5px"></span>Record set</span></div>
      </div>
    </div>
    ${recordsTable(r, unit)}
    ${footer(2)}
  </section>`;
}

function bodyPage(r: ReportData, unit: WeightUnit): string {
  const u = weightLabel(unit);
  const kg = (v: number) => (Math.round(displayWeight(v, unit) * 10) / 10).toFixed(1);
  let body: string;
  if (!r.body) {
    body = `<div class="empty">No weigh-ins in ${esc(r.monthName)}. Log your weight on the Weight tab to see your trend here.</div>`;
  } else {
    const b = r.body;
    const change = Math.round((displayWeight(b.latestKg, unit) - displayWeight(b.startKg, unit)) * 10) / 10;
    const tone = b.towardGoal == null ? "" : b.towardGoal ? "good" : "bad";
    const every = Math.max(1, Math.ceil(b.points.length / 6));
    body =
      `<div class="bstats"><div><div class="label">Start</div><div class="v cond">${kg(b.startKg)}<span class="unit muted"> ${u}</span></div></div><div><div class="label">Latest</div><div class="v cond">${kg(b.latestKg)}<span class="unit muted"> ${u}</span></div></div><div><div class="label">Change</div><div class="v cond ${tone}">${change > 0 ? "+" : change < 0 ? "−" : ""}${Math.abs(change).toFixed(1)}<span class="unit muted"> ${u}</span></div></div></div>` +
      (b.points.length > 1
        ? `<div style="margin-top:10px;background:#FFFFFF;border:1px solid #E3E7EB;border-radius:10px;padding:8px">${lineChart(
            b.points.map((p) => ({ label: dayMonth(p.date), value: Math.round(displayWeight(p.kg, unit) * 10) / 10 })),
            { width: 660, height: 190, color: "#2E7D57", fill: "rgba(46,125,87,0.10)", format: (v) => v.toFixed(1), everyLabel: every },
          )}</div>`
        : "");
  }

  const badges = r.badges.length
    ? `<div class="badges">${r.badges
        .slice(0, 12)
        .map((b) => `<div class="badge"><div class="medal" style="background:${TIER[b.tier]}">★</div><div style="min-width:0"><div class="t">${esc(b.title)}</div><div class="s">Unlocked ${dayMonth(b.date)}</div></div></div>`)
        .join("")}</div>`
    : `<div class="empty">No new badges this month.</div>`;
  const next = r.nextBadges.length
    ? `<div class="card" style="margin-top:12px"><div class="label">Next up</div><div class="next">${r.nextBadges
        .map(
          (n) =>
            `<div style="background:#FFFFFF;border:1px solid #E3E7EB;border-radius:10px;padding:10px"><div class="row" style="justify-content:space-between;font-size:10.5px"><b>${esc(n.title)}</b><span class="muted">${num(n.progress)} / ${num(n.target)}</span></div><div class="bar"><div style="width:${Math.round((n.progress / n.target) * 100)}%"></div></div></div>`,
        )
        .join("")}</div></div>`
    : "";

  return `<section class="page light">
    ${header(r)}
    <h2 class="cond">Your body and badges</h2>
    <div class="sub">Body weight across the month and the milestones you reached.</div>
    <div class="card" style="margin-top:18px"><div class="row" style="justify-content:space-between;align-items:center"><div class="title cond">Body weight</div>${r.body ? `<span class="pill">${r.body.checkIns} ${r.body.checkIns === 1 ? "weigh-in" : "weigh-ins"}</span>` : ""}</div>${body}</div>
    <div style="margin-top:18px" class="row"><div class="grow"><div class="title cond">Badges unlocked</div></div><div class="good" style="font-size:10px;font-weight:700">${r.badges.length} earned</div></div>
    ${badges}
    ${next}
    <div class="insight"><div class="label">Coach insight</div><div class="say cond">${esc(r.insight)}</div></div>
    ${footer(3)}
  </section>`;
}

export function reportHtml(report: ReportData, unit: WeightUnit): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${coverPage(report, unit)}${trainingPage(report, unit)}${bodyPage(report, unit)}</body></html>`;
}
