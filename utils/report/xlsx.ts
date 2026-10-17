/*
 * A small Excel (.xlsx) writer: styled cells, merged ranges, a frozen header,
 * a filter, data bars, formulas with their values, and one bar-and-line chart
 * per sheet. An .xlsx is a zip of XML parts; fflate does the zipping.
 */
import { strToU8, zipSync } from "fflate";

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  /** Font size in points (default 11). */
  size?: number;
  /** "RRGGBB" */
  color?: string;
  /** Background, "RRGGBB". */
  fill?: string;
  /** Excel number format, e.g. "#,##0" or "d mmm yyyy". */
  numFmt?: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
  wrap?: boolean;
  /** Thin line under the cell, "RRGGBB". */
  borderBottom?: string;
  /** Thin line around the cell, "RRGGBB". */
  border?: string;
}

export type CellValue = string | number | null;

export interface Cell {
  v: CellValue;
  /** A date ("YYYY-MM-DD") stored as a real Excel date. */
  date?: string;
  /** A formula (no leading "="); `v` is its value until Excel recalculates. */
  f?: string;
  s?: CellStyle;
}

export interface ChartSeries {
  name: string;
  /** Values: a range on this sheet ("C10:C13") or fixed numbers. */
  values: string | number[];
  /** "RRGGBB" */
  color: string;
  type: "bar" | "line";
  dashed?: boolean;
}

export interface Chart {
  title: string;
  /** Category labels: a range on this sheet ("A10:A13"). */
  categories: string;
  series: ChartSeries[];
  /** Zero-based column/row of the chart's top-left and bottom-right corners. */
  from: { col: number; row: number };
  to: { col: number; row: number };
}

export interface Sheet {
  name: string;
  /** rows[r][c]; empty slots are blank cells. */
  rows: (Cell | null | undefined)[][];
  /** Column widths in characters. */
  widths?: number[];
  /** Row heights in points, by zero-based row. */
  heights?: Record<number, number>;
  /** "A1:H1" */
  merges?: string[];
  /** Rows kept on screen while scrolling. */
  freezeRows?: number;
  /** "A1:I21" */
  filter?: string;
  dataBars?: { range: string; color: string }[];
  chart?: Chart;
  gridLines?: boolean;
  tabColor?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Characters XML can't hold are dropped; the rest are escaped. */
function esc(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 → "A", 26 → "AA". */
export function colName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

export const ref = (col: number, row: number) => `${colName(col)}${row + 1}`;

/** "YYYY-MM-DD" → Excel's day number (days since 30 Dec 1899). */
export function excelDate(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

const argb = (rgb: string) => `FF${rgb.replace("#", "").toUpperCase()}`;

/** Sheet names: at most 31 characters, none of []:*?/\ . */
const sheetName = (name: string) => name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);

/** "Summary!$C$10:$C$13" from "C10:C13". */
function absolute(sheet: string, range: string): string {
  const abs = range
    .split(":")
    .map((r) => r.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2"))
    .join(":");
  return `'${sheetName(sheet).replace(/'/g, "''")}'!${abs}`;
}

/** Cells of a one-column or one-row range, in order. */
function cellsIn(sheet: Sheet, range: string): (Cell | null | undefined)[] {
  const [a, b = a] = range.split(":");
  const parse = (r: string) => {
    const [, letters, digits] = r.match(/^([A-Z]+)(\d+)$/)!;
    const col = [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    return { col, row: Number(digits) - 1 };
  };
  const from = parse(a);
  const to = parse(b);
  const out: (Cell | null | undefined)[] = [];
  for (let r = from.row; r <= to.row; r++) for (let c = from.col; c <= to.col; c++) out.push(sheet.rows[r]?.[c]);
  return out;
}

// ── Styles ───────────────────────────────────────────────────────────────────

class StyleBook {
  private fonts = ['<font><sz val="11"/><color rgb="FF1F2328"/><name val="Calibri"/><family val="2"/></font>'];
  private fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  private borders = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
  private numFmts: string[] = [];
  private xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private ids = new Map<string, number>();

  private add(list: string[], xml: string): number {
    const at = list.indexOf(xml);
    if (at >= 0) return at;
    list.push(xml);
    return list.length - 1;
  }

  /** Index of the cell format for a style (0 = default). */
  id(style: CellStyle | undefined, isDate: boolean): number {
    const s = { ...style, numFmt: style?.numFmt ?? (isDate ? "d mmm yyyy" : undefined) };
    const key = JSON.stringify(s);
    const known = this.ids.get(key);
    if (known != null) return known;

    const font = this.add(
      this.fonts,
      `<font>${s.bold ? "<b/>" : ""}${s.italic ? "<i/>" : ""}<sz val="${s.size ?? 11}"/><color rgb="${argb(s.color ?? "1F2328")}"/><name val="Calibri"/><family val="2"/></font>`,
    );
    const fill = s.fill ? this.add(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(s.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const line = (color?: string) => (color ? ` style="thin"><color rgb="${argb(color)}"/>` : "/>");
    const edge = (side: string, color?: string) => (color ? `<${side}${line(color)}</${side}>` : `<${side}/>`);
    const border =
      s.border || s.borderBottom
        ? this.add(this.borders, `<border>${edge("left", s.border)}${edge("right", s.border)}${edge("top", s.border)}${edge("bottom", s.border ?? s.borderBottom)}<diagonal/></border>`)
        : 0;
    let numFmtId = 0;
    if (s.numFmt) {
      const builtIn: Record<string, number> = { "0": 1, "0.00": 2, "#,##0": 3, "#,##0.00": 4 };
      numFmtId = builtIn[s.numFmt] ?? 164 + this.add(this.numFmts, s.numFmt);
    }
    const alignment = s.align || s.valign || s.wrap ? `<alignment${s.align ? ` horizontal="${s.align}"` : ""}${s.valign ? ` vertical="${s.valign}"` : ""}${s.wrap ? ' wrapText="1"' : ""}/>` : "";
    const xf = `<xf numFmtId="${numFmtId}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ""}${font ? ' applyFont="1"' : ""}${fill ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""}${alignment ? ' applyAlignment="1">' + alignment + "</xf>" : "/>"}`;
    this.xfs.push(xf);
    const id = this.xfs.length - 1;
    this.ids.set(key, id);
    return id;
  }

  xml(): string {
    const numFmts = this.numFmts.length ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join("")}</numFmts>` : "";
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      numFmts +
      `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join("")}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join("")}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>"
    );
  }
}

// ── Parts ────────────────────────────────────────────────────────────────────

function sheetXml(sheet: Sheet, styles: StyleBook, hasDrawing: boolean): string {
  const tab = sheet.tabColor ? `<sheetPr><tabColor rgb="${argb(sheet.tabColor)}"/></sheetPr>` : "";
  const pane = sheet.freezeRows
    ? `<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${sheet.freezeRows + 1}" sqref="A${sheet.freezeRows + 1}"/>`
    : "";
  const views = `<sheetViews><sheetView workbookViewId="0"${sheet.gridLines === false ? ' showGridLines="0"' : ""}${sheet.name === "Summary" ? ' tabSelected="1"' : ""}>${pane}</sheetView></sheetViews>`;
  const cols = sheet.widths?.length ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";

  const rows = sheet.rows
    .map((cells, r) => {
      const height = sheet.heights?.[r];
      const body = (cells ?? [])
        .map((cell, c) => {
          if (!cell) return "";
          const s = styles.id(cell.s, !!cell.date);
          const at = ` r="${ref(c, r)}"${s ? ` s="${s}"` : ""}`;
          if (cell.f) return `<c${at}><f>${esc(cell.f)}</f>${typeof cell.v === "number" ? `<v>${cell.v}</v>` : ""}</c>`;
          if (cell.date) return `<c${at}><v>${excelDate(cell.date)}</v></c>`;
          if (typeof cell.v === "number") return Number.isFinite(cell.v) ? `<c${at}><v>${cell.v}</v></c>` : `<c${at}/>`;
          if (cell.v == null || cell.v === "") return s ? `<c${at}/>` : "";
          return `<c${at} t="inlineStr"><is><t xml:space="preserve">${esc(cell.v)}</t></is></c>`;
        })
        .join("");
      if (!body && height == null) return "";
      return `<row r="${r + 1}"${height != null ? ` ht="${height}" customHeight="1"` : ""}>${body}</row>`;
    })
    .join("");

  const filter = sheet.filter ? `<autoFilter ref="${sheet.filter}"/>` : "";
  const merges = sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  const bars = (sheet.dataBars ?? [])
    .map(
      (b, i) =>
        `<conditionalFormatting sqref="${b.range}"><cfRule type="dataBar" priority="${i + 1}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${argb(b.color)}"/></dataBar></cfRule></conditionalFormatting>`,
    )
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    tab +
    views +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    cols +
    `<sheetData>${rows}</sheetData>` +
    filter +
    merges +
    bars +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    (hasDrawing ? '<drawing r:id="rId1"/>' : "") +
    "</worksheet>"
  );
}

function chartXml(sheet: Sheet, chart: Chart): string {
  const C = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const labels = cellsIn(sheet, chart.categories).map((c) => String(c?.v ?? ""));
  const cat =
    `<c:cat><c:strRef><c:f>${esc(absolute(sheet.name, chart.categories))}</c:f><c:strCache><c:ptCount val="${labels.length}"/>` +
    labels.map((l, i) => `<c:pt idx="${i}"><c:v>${esc(l)}</c:v></c:pt>`).join("") +
    "</c:strCache></c:strRef></c:cat>";
  const numbers = (values: number[]) => `<c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join("")}`;
  const val = (s: ChartSeries) => {
    if (Array.isArray(s.values)) return `<c:val><c:numLit><c:formatCode>General</c:formatCode>${numbers(s.values)}</c:numLit></c:val>`;
    const cached = cellsIn(sheet, s.values).map((c) => (typeof c?.v === "number" ? c.v : 0));
    return `<c:val><c:numRef><c:f>${esc(absolute(sheet.name, s.values))}</c:f><c:numCache><c:formatCode>General</c:formatCode>${numbers(cached)}</c:numCache></c:numRef></c:val>`;
  };
  const series = (s: ChartSeries, i: number) => {
    const look =
      s.type === "bar"
        ? `<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>`
        : `<c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>${s.dashed ? '<a:prstDash val="dash"/>' : ""}</a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>`;
    const dataLabels = s.type === "bar" ? '<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>' : "";
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>${look}${dataLabels}${cat}${val(s)}${s.type === "line" ? '<c:smooth val="0"/>' : ""}</c:ser>`;
  };
  const bars = chart.series.map((s, i) => [s, i] as const).filter(([s]) => s.type === "bar");
  const lines = chart.series.map((s, i) => [s, i] as const).filter(([s]) => s.type === "line");
  const axes = '<c:axId val="500000001"/><c:axId val="500000002"/>';
  const gray = '<c:spPr><a:ln><a:solidFill><a:srgbClr val="D9DDE1"/></a:solidFill></a:ln></c:spPr>';
  const text = (size: number, bold = false) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="5B6672"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    `<c:chartSpace ${C}><c:roundedCorners val="0"/><c:chart>` +
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1200" b="1"><a:solidFill><a:srgbClr val="1F2328"/></a:solidFill></a:rPr><a:t>${esc(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` +
    '<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>' +
    (bars.length ? `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${bars.map(([s, i]) => series(s, i)).join("")}<c:gapWidth val="60"/>${axes}</c:barChart>` : "") +
    (lines.length ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lines.map(([s, i]) => series(s, i)).join("")}<c:marker val="1"/>${axes}</c:lineChart>` : "") +
    `<c:catAx><c:axId val="500000001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${gray}${text(900)}<c:crossAx val="500000002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="500000002"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines>${gray}</c:majorGridlines><c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${text(900)}<c:crossAx val="500000001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/><c:majorUnit val="1"/></c:valAx>` +
    '</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>' +
    '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>' +
    "</c:chartSpace>"
  );
}

function drawingXml(chart: Chart): string {
  const anchor = (tag: string, p: { col: number; row: number }) => `<xdr:${tag}><xdr:col>${p.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${p.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:${tag}>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    `<xdr:twoCellAnchor>${anchor("from", chart.from)}${anchor("to", chart.to)}` +
    '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
    '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic>' +
    "</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>"
  );
}

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rels = (items: { id: string; type: string; target: string }[]) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  items.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`).join("") +
  "</Relationships>";

/** The workbook as .xlsx bytes. */
export function buildXlsx(sheets: Sheet[], meta: { title: string; createdAt: Date }): Uint8Array {
  const styles = new StyleBook();
  const files: Record<string, Uint8Array> = {};
  const put = (path: string, xml: string) => (files[path] = strToU8(xml));
  const charts: number[] = [];

  sheets.forEach((sheet, i) => {
    const n = i + 1;
    put(`xl/worksheets/sheet${n}.xml`, sheetXml(sheet, styles, !!sheet.chart));
    if (sheet.chart) {
      const k = charts.length + 1;
      charts.push(n);
      put(`xl/worksheets/_rels/sheet${n}.xml.rels`, rels([{ id: "rId1", type: `${REL}/drawing`, target: `../drawings/drawing${k}.xml` }]));
      put(`xl/drawings/drawing${k}.xml`, drawingXml(sheet.chart));
      put(`xl/drawings/_rels/drawing${k}.xml.rels`, rels([{ id: "rId1", type: `${REL}/chart`, target: `../charts/chart${k}.xml` }]));
      put(`xl/charts/chart${k}.xml`, chartXml(sheet, sheet.chart));
    }
  });

  put("xl/styles.xml", styles.xml());
  put(
    "xl/workbook.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
      sheets.map((s, i) => `<sheet name="${esc(sheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      "</sheets>" +
      (sheets.some((s) => s.filter)
        ? `<definedNames>${sheets
            .map((s, i) => (s.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(absolute(s.name, s.filter))}</definedName>` : ""))
            .join("")}</definedNames>`
        : "") +
      "</workbook>",
  );
  put(
    "xl/_rels/workbook.xml.rels",
    rels([
      ...sheets.map((_, i) => ({ id: `rId${i + 1}`, type: `${REL}/worksheet`, target: `worksheets/sheet${i + 1}.xml` })),
      { id: `rId${sheets.length + 1}`, type: `${REL}/styles`, target: "styles.xml" },
    ]),
  );

  const created = meta.createdAt.toISOString().replace(/\.\d{3}Z$/, "Z");
  put(
    "docProps/core.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${esc(meta.title)}</dc:title><dc:creator>Iron Arc</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified>` +
      "</cp:coreProperties>",
  );
  put(
    "docProps/app.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Iron Arc</Application></Properties>',
  );
  put(
    "_rels/.rels",
    rels([
      { id: "rId1", type: `${REL}/officeDocument`, target: "xl/workbook.xml" },
      { id: "rId2", type: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", target: "docProps/core.xml" },
      { id: "rId3", type: `${REL}/extended-properties`, target: "docProps/app.xml" },
    ]),
  );
  put(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      charts
        .map(
          (_, k) =>
            `<Override PartName="/xl/drawings/drawing${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
        )
        .join("") +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      "</Types>",
  );

  return zipSync(files, { level: 6 });
}
