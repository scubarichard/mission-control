/**
 * Build Quarterly Review Word template — professional ICP styling with navy/blue theme.
 * Uses docxtemplater {{TAG}} syntax (double curly braces).
 *
 * Run: node scripts/build-template.js
 */

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType } from "docx";
import { writeFileSync } from "fs";

// ── Colors ───────────────────────────────────────────────────────────
const NAVY = "1B3A5C";
const BLUE = "2E6DA4";
const LIGHT_BLUE = "D6E4F0";
const WHITE = "FFFFFF";
const LIGHT_GRAY = "F4F6F8";
const DARK_TEXT = "2C3E50";
const MED_TEXT = "555555";

// ── Helpers ──────────────────────────────────────────────────────────

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }
};

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BLUE } },
    children: [new TextRun({ text, bold: true, size: 26, color: NAVY, font: "Calibri" })]
  });
}

function labelValue(label, tag, opts = {}) {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: label + ": ", bold: true, size: 20, color: MED_TEXT, font: "Calibri" }),
      new TextRun({ text: `{{${tag}}}`, size: 20, color: DARK_TEXT, font: "Calibri", ...opts })
    ]
  });
}

function spacer(size = 100) {
  return new Paragraph({ spacing: { after: size }, children: [] });
}

function hCell(text, width = 2000) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: NAVY },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: WHITE, size: 20, font: "Calibri" })] })]
  });
}

function dCell(text, width = 2000, shade = undefined) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.SOLID, color: shade } : undefined,
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, color: DARK_TEXT, font: "Calibri" })] })]
  });
}

function lCell(label, width = 1800) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, color: MED_TEXT, font: "Calibri" })] })]
  });
}

function vCell(tag, width = 3200) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: `{{${tag}}}`, size: 20, color: DARK_TEXT, font: "Calibri" })] })]
  });
}

// ── Document ─────────────────────────────────────────────────────────

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 22, color: DARK_TEXT } } } },
  sections: [{
    properties: { page: { margin: { top: 600, bottom: 600, left: 800, right: 800 } } },
    children: [

      // ══ HEADER BAND ════════════════════════════════════════════════
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
        rows: [new TableRow({ children: [
          new TableCell({
            width: { size: 10000, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: NAVY },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [
              new Paragraph({ children: [
                new TextRun({ text: "DAX", bold: true, size: 36, color: WHITE, font: "Calibri" }),
                new TextRun({ text: "  |  Quarterly Investment Review", size: 28, color: LIGHT_BLUE, font: "Calibri" })
              ]}),
              new Paragraph({ spacing: { before: 60 }, children: [
                new TextRun({ text: "{{FIRM_NAME}}", size: 22, color: LIGHT_BLUE, font: "Calibri" }),
                new TextRun({ text: "  |  {{REPORT_PERIOD}}", size: 22, color: LIGHT_BLUE, font: "Calibri" })
              ]})
            ]
          })
        ]})]
      }),

      spacer(200),

      // ══ CLIENT INFORMATION ═════════════════════════════════════════
      sectionHeading("Client Information"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
        rows: [
          new TableRow({ children: [lCell("Client:"), vCell("CLIENT_NAME"), lCell("Account #:"), vCell("ACCOUNT_NUMBER")] }),
          new TableRow({ children: [lCell("Account Type:"), vCell("ACCOUNT_TYPE"), lCell("Report Period:"), vCell("REPORT_PERIOD")] }),
          new TableRow({ children: [lCell("Advisor:"), vCell("ADVISOR_NAME"), lCell("Report Date:"), vCell("REPORT_DATE")] }),
        ]
      }),

      spacer(),

      // ══ PORTFOLIO PERFORMANCE ══════════════════════════════════════
      sectionHeading("Portfolio Performance"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [hCell("Portfolio Value", 2200), hCell("YTD Return", 1800), hCell("Benchmark", 1800), hCell("vs Benchmark", 1800), hCell("Top Holding", 2400)] }),
          new TableRow({ children: [
            dCell("{{PORTFOLIO_VALUE}}", 2200, LIGHT_BLUE),
            dCell("{{YTD_RETURN}}", 1800, LIGHT_BLUE),
            dCell("{{BENCHMARK_RETURN}}", 1800, LIGHT_BLUE),
            dCell("{{VS_BENCHMARK}}", 1800, LIGHT_BLUE),
            dCell("{{TOP_HOLDING}}", 2400, LIGHT_BLUE),
          ] }),
        ]
      }),

      spacer(),

      // ══ CLIENT PROFILE ═════════════════════════════════════════════
      sectionHeading("Client Profile"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
        rows: [
          new TableRow({ children: [lCell("Risk Tolerance:"), vCell("RISK_PROFILE"), lCell("Objective:"), vCell("INVESTMENT_OBJECTIVE")] }),
          new TableRow({ children: [lCell("Time Horizon:"), vCell("TIME_HORIZON"), lCell(""), dCell("", 3200)] }),
        ]
      }),
      new Paragraph({ spacing: { before: 80, after: 80 }, children: [
        new TextRun({ text: "Background: ", bold: true, size: 20, color: MED_TEXT, font: "Calibri" }),
        new TextRun({ text: "{{BACKGROUND_INFO}}", size: 20, color: DARK_TEXT, font: "Calibri" })
      ]}),

      spacer(),

      // ══ CLIENT GOALS ═══════════════════════════════════════════════
      sectionHeading("Client Goals"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [hCell("#", 600), hCell("Goal", 9400)] }),
          new TableRow({ children: [dCell("1", 600, LIGHT_GRAY), dCell("{{GOAL_1}}", 9400, LIGHT_GRAY)] }),
          new TableRow({ children: [dCell("2", 600), dCell("{{GOAL_2}}", 9400)] }),
          new TableRow({ children: [dCell("3", 600, LIGHT_GRAY), dCell("{{GOAL_3}}", 9400, LIGHT_GRAY)] }),
        ]
      }),
      new Paragraph({ spacing: { before: 80 }, children: [
        new TextRun({ text: "Progress Notes: ", bold: true, size: 20, color: MED_TEXT, font: "Calibri" }),
        new TextRun({ text: "{{GOALS_PROGRESS_NOTES}}", size: 20, color: DARK_TEXT, font: "Calibri" })
      ]}),

      spacer(),

      // ══ MEETING DISCUSSION ═════════════════════════════════════════
      sectionHeading("Meeting Discussion"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
        rows: [
          new TableRow({ children: [lCell("Date:", 1200), vCell("MEETING_DATE", 3800), lCell("Location:", 1200), vCell("MEETING_LOCATION", 3800)] }),
          new TableRow({ children: [lCell("Duration:", 1200), vCell("MEETING_DURATION", 3800), lCell("Attendees:", 1200), vCell("ATTENDEES", 3800)] }),
        ]
      }),
      new Paragraph({ spacing: { before: 120 }, children: [
        new TextRun({ text: "Key Discussion Points:", bold: true, size: 20, color: MED_TEXT, font: "Calibri" })
      ]}),
      new Paragraph({ spacing: { after: 30 }, indent: { left: 360 }, children: [new TextRun({ text: "1. {{DISCUSSION_POINT_1}}", size: 20, font: "Calibri" })] }),
      new Paragraph({ spacing: { after: 30 }, indent: { left: 360 }, children: [new TextRun({ text: "2. {{DISCUSSION_POINT_2}}", size: 20, font: "Calibri" })] }),
      new Paragraph({ spacing: { after: 30 }, indent: { left: 360 }, children: [new TextRun({ text: "3. {{DISCUSSION_POINT_3}}", size: 20, font: "Calibri" })] }),
      new Paragraph({ spacing: { before: 80, after: 80 }, children: [
        new TextRun({ text: "Advisor Notes: ", bold: true, size: 20, color: MED_TEXT, font: "Calibri" }),
        new TextRun({ text: "{{ADVISOR_NOTES}}", size: 20, color: DARK_TEXT, font: "Calibri" })
      ]}),

      spacer(),

      // ══ ACTION ITEMS ═══════════════════════════════════════════════
      sectionHeading("Action Items"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [hCell("#", 500), hCell("Action", 5000), hCell("Owner", 2200), hCell("Due Date", 2300)] }),
          new TableRow({ children: [dCell("1", 500, LIGHT_GRAY), dCell("{{ACTION_1}}", 5000, LIGHT_GRAY), dCell("{{ACTION_1_OWNER}}", 2200, LIGHT_GRAY), dCell("{{ACTION_1_DUE}}", 2300, LIGHT_GRAY)] }),
          new TableRow({ children: [dCell("2", 500), dCell("{{ACTION_2}}", 5000), dCell("{{ACTION_2_OWNER}}", 2200), dCell("{{ACTION_2_DUE}}", 2300)] }),
          new TableRow({ children: [dCell("3", 500, LIGHT_GRAY), dCell("{{ACTION_3}}", 5000, LIGHT_GRAY), dCell("{{ACTION_3_OWNER}}", 2200, LIGHT_GRAY), dCell("{{ACTION_3_DUE}}", 2300, LIGHT_GRAY)] }),
        ]
      }),

      spacer(),

      // ══ NEXT STEPS ═════════════════════════════════════════════════
      sectionHeading("Next Steps"),
      labelValue("Next Meeting", "NEXT_MEETING_DATE"),
      labelValue("Agenda", "NEXT_MEETING_AGENDA"),

      spacer(200),

      // ══ FOOTER BAND ════════════════════════════════════════════════
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
        rows: [new TableRow({ children: [
          new TableCell({
            width: { size: 10000, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: NAVY },
            margins: { top: 80, bottom: 80, left: 200, right: 200 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "Generated {{REPORT_DATE}}  |  Powered by DAX — Governed AI for RIAs", size: 17, color: LIGHT_BLUE, font: "Calibri", italics: true })
              ]}),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "Prepared by {{ADVISOR_NAME}} for {{CLIENT_NAME}}", size: 17, color: LIGHT_BLUE, font: "Calibri", italics: true })
              ]})
            ]
          })
        ]})]
      }),
    ]
  }]
});

const buffer = await Packer.toBuffer(doc);
const outPath = "docs/templates/Quarterly-Review-TEMPLATE.docx";
writeFileSync(outPath, buffer);
console.log(`Template saved: ${outPath} (${buffer.length} bytes)`);
